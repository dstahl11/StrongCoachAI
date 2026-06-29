import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  exercises,
  workouts,
  workoutExercises,
  setGroups,
  loggedSets,
} from "../db/schema";

/**
 * Importer for Barbell Logic / TurnKey "workout history" CSV exports.
 *
 * Each CSV row is one set. Rows are grouped by `workout_id` into workouts,
 * then by `exercise_name` into exercises (A/B/C…), then into prescription
 * set-groups keyed by the assigned (sets × reps @ weight) tuple. Rows that
 * carry an `actual_weight` become logged sets.
 */

type Row = Record<string, string>;

const numOrNull = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const intOrNull = (v: string | undefined): number | null => {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
};

export type ImportSummary = {
  workouts: number;
  exercises: number;
  loggedSets: number;
  skippedRows: number;
};

export function parseWorkoutCsv(text: string): Row[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Row[];
}

type PendingGroup = { sets: number; reps: number; weight: number };
type PendingExercise = {
  name: string;
  groups: Map<string, PendingGroup>;
  logged: { reps: number; weight: number }[];
};
type PendingWorkout = {
  date: string;
  completed: boolean;
  order: string[]; // exercise names in first-seen order
  byName: Map<string, PendingExercise>;
};

function groupRows(rows: Row[]) {
  const workoutsById = new Map<string, PendingWorkout>();
  const exerciseNames = new Set<string>();
  let skipped = 0;

  for (const r of rows) {
    const wid = r.workout_id?.trim();
    const date = r.workout_date?.trim();
    const name = r.exercise_name?.trim();
    if (!wid || !date || !name) {
      skipped++;
      continue;
    }
    exerciseNames.add(name);

    let w = workoutsById.get(wid);
    if (!w) {
      w = {
        date,
        completed: r.workout_completed?.trim().toLowerCase() === "true",
        order: [],
        byName: new Map(),
      };
      workoutsById.set(wid, w);
    }

    let ex = w.byName.get(name);
    if (!ex) {
      ex = { name, groups: new Map(), logged: [] };
      w.byName.set(name, ex);
      w.order.push(name);
    }

    const sets = intOrNull(r.assigned_sets) ?? 1;
    const reps = intOrNull(r.assigned_reps) ?? 0;
    const weight = numOrNull(r.assigned_weight) ?? 0;
    const key = `${sets}|${reps}|${weight}`;
    if (!ex.groups.has(key)) ex.groups.set(key, { sets, reps, weight });

    const aw = numOrNull(r.actual_weight);
    if (aw !== null) {
      ex.logged.push({ reps: intOrNull(r.actual_reps) ?? reps, weight: aw });
    }
  }

  return { workoutsById, exerciseNames, skipped };
}

export async function importWorkouts(
  rows: Row[],
  opts: { replace: boolean; userId: number },
): Promise<ImportSummary> {
  const { workoutsById, exerciseNames, skipped } = groupRows(rows);
  const { userId } = opts;

  let loggedCount = 0;

  // Everything runs in ONE transaction: a single commit/fsync instead of one
  // per statement turns a multi-second import into a sub-second one.
  await db.transaction(async (tx) => {
    if (opts.replace) {
      // only wipe THIS user's workouts (cascades to exercises/sets/logged sets)
      await tx.delete(workouts).where(eq(workouts.userId, userId));
      // keep the exercise catalog; we upsert below
    }

    // --- Exercises: ensure every name exists, build name -> id map ---
    const existing = await tx.select().from(exercises);
    const idByName = new Map<string, number>(
      existing.map((e) => [e.name.toLowerCase(), e.id]),
    );
    const toCreate = [...exerciseNames].filter(
      (n) => !idByName.has(n.toLowerCase()),
    );
    if (toCreate.length) {
      const created = await tx
        .insert(exercises)
        .values(toCreate.map((name) => ({ name })))
        .returning();
      for (const e of created) idByName.set(e.name.toLowerCase(), e.id);
    }

    // Bulk insert in batched passes. Drizzle returns rows in insertion order,
    // so we zip the returned ids back onto our flat lists.
    const orderedWorkouts = [...workoutsById.values()];

    // 1) workouts
    const woRows = await chunkedInsertReturning(
      tx,
      workouts,
      orderedWorkouts.map((w) => ({
        userId,
        date: w.date,
        title: "Workout",
        status: w.completed ? "complete" : "upcoming",
        completedAt: w.completed ? new Date(w.date + "T12:00:00") : null,
      })),
    );

    // 2) workout_exercises (flattened, in workout/exercise order)
    type WeFlat = { ex: PendingExercise; completed: boolean };
    const weFlat: WeFlat[] = [];
    const weValues: (typeof workoutExercises.$inferInsert)[] = [];
    orderedWorkouts.forEach((w, wi) => {
      const workoutId = woRows[wi].id;
      w.order.forEach((name, position) => {
        const ex = w.byName.get(name)!;
        weFlat.push({ ex, completed: w.completed });
        weValues.push({
          workoutId,
          exerciseId: idByName.get(name.toLowerCase())!,
          position,
        });
      });
    });
    const weRows = await chunkedInsertReturning(tx, workoutExercises, weValues);

    // 3) set_groups + logged_sets
    const sgValues: (typeof setGroups.$inferInsert)[] = [];
    const lsValues: (typeof loggedSets.$inferInsert)[] = [];
    weFlat.forEach(({ ex, completed }, i) => {
      const weId = weRows[i].id;
      const groups = [...ex.groups.values()];
      groups.forEach((g, gi) =>
        sgValues.push({
          workoutExerciseId: weId,
          position: gi,
          sets: g.sets,
          reps: g.reps,
          weight: g.weight.toFixed(2),
        }),
      );

      // actuals if present; else synthesize from the prescription for completed
      let logged = ex.logged;
      if (logged.length === 0 && completed) {
        logged = groups.flatMap((g) =>
          Array.from({ length: Math.max(1, g.sets) }, () => ({
            reps: g.reps,
            weight: g.weight,
          })),
        );
      }
      logged.forEach((l, li) =>
        lsValues.push({
          workoutExerciseId: weId,
          setNumber: li + 1,
          reps: l.reps,
          weight: l.weight.toFixed(2),
          completed: true,
        }),
      );
      loggedCount += logged.length;
    });

    await chunkedInsert(tx, setGroups, sgValues);
    await chunkedInsert(tx, loggedSets, lsValues);
  });

  return {
    workouts: workoutsById.size,
    exercises: exerciseNames.size,
    loggedSets: loggedCount,
    skippedRows: skipped,
  };
}

// Postgres caps bind params at 65535; keep each batch well under that.
const CHUNK = 1000;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function chunkedInsert(tx: any, table: any, values: any[]) {
  for (let i = 0; i < values.length; i += CHUNK) {
    const slice = values.slice(i, i + CHUNK);
    if (slice.length) await tx.insert(table).values(slice);
  }
}

async function chunkedInsertReturning(
  tx: any,
  table: any,
  values: any[],
): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < values.length; i += CHUNK) {
    const slice = values.slice(i, i + CHUNK);
    if (slice.length) {
      const returned = (await tx
        .insert(table)
        .values(slice)
        .returning()) as any[];
      out.push(...returned);
    }
  }
  return out;
}
