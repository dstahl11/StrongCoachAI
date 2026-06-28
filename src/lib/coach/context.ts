import "server-only";
import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  coachProfile,
  coachMemories,
  workouts,
  workoutExercises,
  exercises,
  setGroups,
  loggedSets,
  type CoachProfile,
  type CoachMemory,
} from "@/db/schema";
import { todayISO, fmt } from "@/lib/dates";
import { fmtWeight, epley1RM } from "@/lib/strength";
import { STARTING_STRENGTH } from "./starting-strength";

const num = (v: string | number | null) =>
  v === null ? 0 : typeof v === "number" ? v : parseFloat(v);

export async function getCoachProfile(): Promise<CoachProfile> {
  const [p] = await db.select().from(coachProfile).where(eq(coachProfile.id, 1));
  if (p) return p;
  // fall back to an in-memory default if the seed hasn't run
  return {
    id: 1,
    name: "Coach",
    persona: "",
    model: "claude-sonnet-4-6",
    remindersEnabled: false,
    digestEnabled: false,
    reminderEmail: null,
    missedGraceDays: 1,
    inactivityDays: 3,
    digestHour: 7,
    autonomousProgramming: false,
    programConfig: null,
    updatedAt: new Date(),
  };
}

export async function getMemories(): Promise<CoachMemory[]> {
  return db
    .select()
    .from(coachMemories)
    .orderBy(desc(coachMemories.pinned), asc(coachMemories.createdAt));
}

export type TrainingSummary = {
  today: string;
  lastWorkoutDate: string | null;
  daysSinceLast: number | null;
  currentWeights: { name: string; weight: number; reps: number; e1rm: number; date: string }[];
  recentSessions: { date: string; lines: string[] }[];
  upcoming: { date: string; lines: string[] }[];
  misses: { date: string; lines: string[] }[];
};

/** A compact, current snapshot of the athlete's training for the coach's context. */
export async function getTrainingSummary(): Promise<TrainingSummary> {
  const today = todayISO();

  // recent completed sessions (last 8) with their top logged set per exercise
  const completed = await db
    .select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .where(eq(workouts.status, "complete"))
    .orderBy(desc(workouts.date))
    .limit(8);

  const lineFor = async (workoutId: number, useLogged: boolean) => {
    const wes = await db.query.workoutExercises.findMany({
      where: eq(workoutExercises.workoutId, workoutId),
      orderBy: asc(workoutExercises.position),
      with: {
        exercise: true,
        setGroups: { orderBy: asc(setGroups.position) },
        loggedSets: { orderBy: asc(loggedSets.setNumber) },
      },
    });
    return wes
      .filter((we) => !we.skipped)
      .map((we) => {
        if (useLogged && we.loggedSets.length) {
          const top = we.loggedSets.reduce(
            (a, b) => (num(b.weight) > num(a.weight) ? b : a),
            we.loggedSets[0],
          );
          return `${we.exercise.name}: ${we.loggedSets.length} x ${top.reps} @ ${fmtWeight(num(top.weight))} lb`;
        }
        const g = we.setGroups[0];
        return g
          ? `${we.exercise.name}: ${g.sets} x ${g.reps} @ ${fmtWeight(num(g.weight))} lb`
          : we.exercise.name;
      });
  };

  const recentSessions: TrainingSummary["recentSessions"] = [];
  for (const w of completed) {
    recentSessions.push({ date: w.date, lines: await lineFor(w.id, true) });
  }

  // current working weight per exercise (latest completed top set)
  const cw = await db
    .select({
      name: exercises.name,
      date: workouts.date,
      reps: loggedSets.reps,
      weight: loggedSets.weight,
    })
    .from(loggedSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, loggedSets.workoutExerciseId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(eq(loggedSets.completed, true))
    .orderBy(desc(workouts.date), desc(loggedSets.weight));

  const seen = new Map<string, { name: string; weight: number; reps: number; e1rm: number; date: string }>();
  for (const r of cw) {
    if (seen.has(r.name)) continue;
    const w = num(r.weight);
    seen.set(r.name, {
      name: r.name,
      weight: w,
      reps: r.reps,
      e1rm: Math.round(epley1RM(w, r.reps) * 10) / 10,
      date: r.date,
    });
  }
  const currentWeights = [...seen.values()].slice(0, 12);

  const lastWorkoutDate = completed[0]?.date ?? null;
  const daysSinceLast = lastWorkoutDate
    ? Math.round(
        (new Date(today + "T00:00:00").getTime() -
          new Date(lastWorkoutDate + "T00:00:00").getTime()) /
          86400000,
      )
    : null;

  // upcoming (next planned, date >= today)
  const up = await db
    .select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .where(and(gte(workouts.date, today), eq(workouts.status, "upcoming")))
    .orderBy(asc(workouts.date))
    .limit(5);
  const upcoming: TrainingSummary["upcoming"] = [];
  for (const w of up) upcoming.push({ date: w.date, lines: await lineFor(w.id, false) });

  // misses (planned in the past, not completed)
  const ms = await db
    .select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .where(and(lt(workouts.date, today), ne(workouts.status, "complete")))
    .orderBy(desc(workouts.date))
    .limit(5);
  const misses: TrainingSummary["misses"] = [];
  for (const w of ms) misses.push({ date: w.date, lines: await lineFor(w.id, false) });

  return {
    today,
    lastWorkoutDate,
    daysSinceLast,
    currentWeights,
    recentSessions,
    upcoming,
    misses,
  };
}

function summaryToText(s: TrainingSummary): string {
  const parts: string[] = [];
  parts.push(`Today is ${fmt.dayLong(s.today)} (${s.today}).`);
  if (s.lastWorkoutDate) {
    parts.push(
      `Last completed workout: ${fmt.dayShort(s.lastWorkoutDate)} (${s.daysSinceLast} day(s) ago).`,
    );
  } else {
    parts.push("No completed workouts on record yet.");
  }
  if (s.currentWeights.length) {
    parts.push(
      "Current working weights (most recent top set per lift):\n" +
        s.currentWeights
          .map(
            (c) =>
              `- ${c.name}: ${c.reps} reps @ ${fmtWeight(c.weight)} lb (e1RM ~${fmtWeight(c.e1rm)}), on ${fmt.histDate(c.date)}`,
          )
          .join("\n"),
    );
  }
  if (s.recentSessions.length) {
    parts.push(
      "Recent sessions:\n" +
        s.recentSessions
          .map((r) => `- ${fmt.histDate(r.date)}: ${r.lines.join("; ") || "—"}`)
          .join("\n"),
    );
  }
  if (s.upcoming.length) {
    parts.push(
      "Upcoming planned:\n" +
        s.upcoming
          .map((r) => `- ${fmt.histDate(r.date)}: ${r.lines.join("; ") || "—"}`)
          .join("\n"),
    );
  }
  if (s.misses.length) {
    parts.push(
      "Recently missed/not completed:\n" +
        s.misses
          .map((r) => `- ${fmt.histDate(r.date)}: ${r.lines.join("; ") || "—"}`)
          .join("\n"),
    );
  }
  return parts.join("\n\n");
}

export function memoriesToText(memories: CoachMemory[]): string {
  if (!memories.length) return "(no saved memories yet)";
  return memories
    .map((m) => `- [${m.kind}] ${m.content}`)
    .join("\n");
}

/** Assemble the full system prompt for a coach turn. */
export async function buildSystemPrompt(): Promise<{
  prompt: string;
  profile: CoachProfile;
}> {
  const [profile, memories, summary] = await Promise.all([
    getCoachProfile(),
    getMemories(),
    getTrainingSummary(),
  ]);

  const prompt = `${profile.persona || "You are a knowledgeable, encouraging strength coach."}

You are ${profile.name}, the athlete's personal strength coach inside the StrongCoach app.
You coach in the Starting Strength tradition and you have a real relationship with this athlete.

# Hard safety rules
- ALWAYS respect the athlete's stated injury limits and weight caps below. Program UNDER them, never to or past them.
- If the athlete reports pain or injury, back off and recommend they consult a medical professional. You are not a doctor.
- Substitute around limitations rather than forcing contraindicated movements.

# What you remember about this athlete
${memoriesToText(memories)}

# Starting Strength reference
${STARTING_STRENGTH}

# The athlete's current training
${summaryToText(summary)}

# How to act
- Be concise and conversational — you're texting your athlete, not writing an essay.
- When the athlete tells you something worth remembering (an injury, preference, goal, schedule constraint), call the remember tool.
- When asked to plan or schedule a session, use the schedule_workout tool with concrete weights derived from their current working weights and Starting Strength progression — respecting all caps and exclusions.
- When they ask to change how they train (split, caps, excluded lifts, increments), call update_program_config so it sticks for future programming.
- Reference real numbers from their training above. Don't invent data.`;

  return { prompt, profile };
}
