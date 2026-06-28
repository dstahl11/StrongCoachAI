import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDay, parseISO } from "date-fns";
import { db } from "@/db";
import {
  workouts,
  workoutExercises,
  exercises,
  setGroups,
  loggedSets,
  type CoachProfile,
} from "@/db/schema";
import { todayISO, shiftISO } from "@/lib/dates";
import { roundToPlate } from "@/lib/strength";
import { getBlackouts } from "./blackouts";

const num = (v: string | number | null) =>
  v === null ? 0 : typeof v === "number" ? v : parseFloat(v);

type ProgramConfig = {
  daysOfWeek?: number[]; // 0=Sun..6=Sat
  increments?: Record<string, number>;
  caps?: Record<string, number>;
  excluded?: string[];
};

function cfg(profile: CoachProfile): Required<ProgramConfig> {
  const c = (profile.programConfig as ProgramConfig) ?? {};
  return {
    daysOfWeek: c.daysOfWeek?.length ? c.daysOfWeek : [1, 3, 5],
    increments: c.increments ?? {},
    caps: c.caps ?? {},
    excluded: c.excluded ?? [],
  };
}

/** Default per-session increment by lift type (lb). */
function defaultIncrement(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("deadlift") || n.includes("squat") || n.includes("pull")) return 5;
  if (n.includes("press") || n.includes("bench")) return 2.5;
  return 5;
}

function incrementFor(name: string, c: Required<ProgramConfig>): number {
  // explicit config key match (case-insensitive substring) wins
  for (const [k, v] of Object.entries(c.increments)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return defaultIncrement(name);
}

function capFor(name: string, c: Required<ProgramConfig>): number | null {
  for (const [k, v] of Object.entries(c.caps)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return null;
}

function isExcluded(name: string, c: Required<ProgramConfig>): boolean {
  return c.excluded.some((x) => name.toLowerCase().includes(x.toLowerCase()));
}

type TemplateExercise = { name: string; sets: number; reps: number };
type PlannedExercise = TemplateExercise & { weight: number };

/** Derive an A/B (or A) rotation from the athlete's most recent sessions. */
async function deriveTemplates(): Promise<TemplateExercise[][]> {
  const completed = await db
    .select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .where(eq(workouts.status, "complete"))
    .orderBy(desc(workouts.date))
    .limit(8);

  const templates: TemplateExercise[][] = [];
  const seenSignatures = new Set<string>();

  for (const w of completed) {
    const wes = await db.query.workoutExercises.findMany({
      where: eq(workoutExercises.workoutId, w.id),
      orderBy: asc(workoutExercises.position),
      with: { exercise: true, setGroups: { orderBy: asc(setGroups.position) } },
    });
    const exs: TemplateExercise[] = wes
      .filter((we) => !we.skipped && we.setGroups[0])
      .map((we) => ({
        name: we.exercise.name,
        sets: we.setGroups[0].sets,
        reps: we.setGroups[0].reps,
      }));
    if (!exs.length) continue;
    const sig = exs.map((e) => e.name).sort().join("|");
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);
    templates.push(exs);
    if (templates.length >= 2) break;
  }
  return templates;
}

/** Most recent completed top-set weight per exercise name. */
async function currentWeights(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      name: exercises.name,
      date: workouts.date,
      weight: loggedSets.weight,
    })
    .from(loggedSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, loggedSets.workoutExerciseId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(eq(loggedSets.completed, true))
    .orderBy(desc(workouts.date), desc(loggedSets.weight));
  const m = new Map<string, number>();
  for (const r of rows) if (!m.has(r.name)) m.set(r.name, num(r.weight));
  return m;
}

function progressExercise(
  t: TemplateExercise,
  last: number | undefined,
  c: Required<ProgramConfig>,
): PlannedExercise {
  const base = last ?? 0;
  const inc = incrementFor(t.name, c);
  let weight = base > 0 ? base + inc : base;
  const cap = capFor(t.name, c);
  if (cap !== null && weight > cap) weight = cap;
  weight = roundToPlate(weight);
  return { name: t.name, sets: t.sets, reps: t.reps, weight };
}

export type PlannedSession = { date: string; exercises: PlannedExercise[] };

/**
 * Ensure the next `daysAhead` training days are populated with coach-programmed
 * sessions. Idempotent: skips days already planned or blacked out. Returns the
 * sessions it created.
 */
export async function ensureScheduled(
  profile: CoachProfile,
  daysAhead = 14,
): Promise<PlannedSession[]> {
  const c = cfg(profile);
  const templates = await deriveTemplates();
  if (!templates.length) return []; // nothing to base programming on yet

  const weights = await currentWeights();
  const blackouts = await getBlackouts();
  const isBlackout = (d: string) =>
    blackouts.some((b) => d >= b.startDate && d <= b.endDate);

  const today = todayISO();
  const created: PlannedSession[] = [];

  // figure out where we are in the rotation by counting existing future coach days
  let rotation = 0;

  for (let i = 1; i <= daysAhead; i++) {
    const date = shiftISO(today, i);
    const dow = getDay(parseISO(date + "T00:00:00"));
    if (!c.daysOfWeek.includes(dow)) continue;
    if (isBlackout(date)) continue;

    const existing = await db.query.workouts.findFirst({
      where: eq(workouts.date, date),
    });
    if (existing) {
      rotation++; // keep rotation aligned even when a day is already planned
      continue;
    }

    const template = templates[rotation % templates.length]
      .filter((t) => !isExcluded(t.name, c))
      .map((t) => progressExercise(t, weights.get(t.name), c));
    rotation++;
    if (!template.length) continue;

    const [wo] = await db
      .insert(workouts)
      .values({ date, title: "Workout", status: "upcoming", source: "coach" })
      .returning();
    let pos = 0;
    for (const ex of template) {
      const exId = await resolveExerciseId(ex.name);
      const [we] = await db
        .insert(workoutExercises)
        .values({ workoutId: wo.id, exerciseId: exId, position: pos++ })
        .returning();
      await db.insert(setGroups).values({
        workoutExerciseId: we.id,
        position: 0,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight.toFixed(2),
      });
      // advance the "current weight" so multiple future days of the same lift keep climbing
      weights.set(ex.name, ex.weight);
    }
    created.push({ date, exercises: template });
  }
  return created;
}

async function resolveExerciseId(name: string): Promise<number> {
  const trimmed = name.trim();
  const all = await db.select().from(exercises);
  const found = all.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  if (found) return found.id;
  const [created] = await db.insert(exercises).values({ name: trimmed }).returning();
  return created.id;
}
