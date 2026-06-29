import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  workouts,
  workoutExercises,
  setGroups,
  loggedSets,
} from "@/db/schema";
import { epley1RM } from "./strength";

export type SetGroupView = {
  id: number;
  sets: number;
  reps: number;
  weight: number;
  isWarmup: boolean;
};

export type LoggedSetView = {
  id: number;
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
  rpe: number | null;
  videoUrl: string | null;
};

export type WorkoutExerciseView = {
  id: number;
  position: number;
  comment: string | null;
  videoUrl: string | null;
  skipped: boolean;
  exercise: { id: number; name: string; demoUrl: string | null };
  setGroups: SetGroupView[];
  loggedSets: LoggedSetView[];
};

export type WorkoutView = {
  id: number;
  date: string;
  title: string;
  status: string;
  source: string;
  notes: string | null;
  exercises: WorkoutExerciseView[];
};

const num = (v: string | null | number) =>
  v === null ? 0 : typeof v === "number" ? v : parseFloat(v);

/** Full workout for a given date (scoped to the user), or null if none. */
export async function getWorkoutByDate(
  date: string,
  userId: number,
): Promise<WorkoutView | null> {
  const wo = await db.query.workouts.findFirst({
    where: and(eq(workouts.date, date), eq(workouts.userId, userId)),
    with: {
      exercises: {
        orderBy: asc(workoutExercises.position),
        with: {
          exercise: true,
          setGroups: { orderBy: asc(setGroups.position) },
          loggedSets: { orderBy: asc(loggedSets.setNumber) },
        },
      },
    },
  });
  if (!wo) return null;
  return {
    id: wo.id,
    date: wo.date,
    title: wo.title,
    status: wo.status,
    source: wo.source,
    notes: wo.notes,
    exercises: wo.exercises.map((we) => ({
      id: we.id,
      position: we.position,
      comment: we.comment,
      videoUrl: we.videoUrl,
      skipped: we.skipped,
      exercise: {
        id: we.exercise.id,
        name: we.exercise.name,
        demoUrl: we.exercise.demoUrl,
      },
      setGroups: we.setGroups.map((g) => ({
        id: g.id,
        sets: g.sets,
        reps: g.reps,
        weight: num(g.weight),
        isWarmup: g.isWarmup,
      })),
      loggedSets: we.loggedSets.map((l) => ({
        id: l.id,
        setNumber: l.setNumber,
        reps: l.reps,
        weight: num(l.weight),
        completed: l.completed,
        rpe: l.rpe ? num(l.rpe) : null,
        videoUrl: l.videoUrl,
      })),
    })),
  };
}

export type DaySummary = {
  date: string;
  status: string | null;
  exercises: { name: string; sets: number; reps: number; weight: number }[];
};

/** Lightweight summaries for a set of dates (week strip + day card). */
export async function getDaySummaries(
  dates: string[],
  userId: number,
): Promise<Record<string, DaySummary>> {
  const rows = await db
    .select({
      date: workouts.date,
      status: workouts.status,
      name: exercises.name,
      position: workoutExercises.position,
      gPos: setGroups.position,
      sets: setGroups.sets,
      reps: setGroups.reps,
      weight: setGroups.weight,
    })
    .from(workouts)
    .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .leftJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .leftJoin(setGroups, eq(setGroups.workoutExerciseId, workoutExercises.id))
    .where(and(inArray(workouts.date, dates), eq(workouts.userId, userId)))
    .orderBy(asc(workouts.date), asc(workoutExercises.position), asc(setGroups.position));

  const out: Record<string, DaySummary> = {};
  for (const r of rows) {
    if (!out[r.date]) out[r.date] = { date: r.date, status: r.status, exercises: [] };
    // take the first set-group per exercise for the summary line
    if (r.name && r.sets != null) {
      const existing = out[r.date].exercises.find((e) => e.name === r.name);
      if (!existing) {
        out[r.date].exercises.push({
          name: r.name,
          sets: r.sets,
          reps: r.reps!,
          weight: num(r.weight),
        });
      }
    }
  }
  return out;
}

export type HistoryEntry = {
  date: string;
  sets: number;
  reps: number;
  weight: number;
  e1rm: number;
  videoUrl: string | null;
};

/** Per-exercise logged history (newest first), with e1RM per session. */
export async function getExerciseHistory(
  exerciseId: number,
  userId: number,
): Promise<HistoryEntry[]> {
  const rows = await db
    .select({
      date: workouts.date,
      reps: loggedSets.reps,
      weight: loggedSets.weight,
      videoUrl: loggedSets.videoUrl,
      weId: workoutExercises.id,
    })
    .from(loggedSets)
    .innerJoin(
      workoutExercises,
      eq(workoutExercises.id, loggedSets.workoutExerciseId),
    )
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        eq(loggedSets.completed, true),
        eq(workouts.userId, userId),
      ),
    )
    .orderBy(desc(workouts.date), asc(loggedSets.setNumber));

  // group by workout-exercise (one session) -> top set + count
  const byWe = new Map<
    number,
    { date: string; weight: number; reps: number; count: number; videoUrl: string | null }
  >();
  for (const r of rows) {
    const w = num(r.weight);
    const cur = byWe.get(r.weId);
    if (!cur) {
      byWe.set(r.weId, {
        date: r.date,
        weight: w,
        reps: r.reps,
        count: 1,
        videoUrl: r.videoUrl,
      });
    } else {
      cur.count += 1;
      if (w > cur.weight) {
        cur.weight = w;
        cur.reps = r.reps;
      }
      if (!cur.videoUrl && r.videoUrl) cur.videoUrl = r.videoUrl;
    }
  }
  return [...byWe.values()].map((s) => ({
    date: s.date,
    sets: s.count,
    reps: s.reps,
    weight: s.weight,
    e1rm: Math.round(epley1RM(s.weight, s.reps) * 10) / 10,
    videoUrl: s.videoUrl,
  }));
}

export type ExercisePR = {
  reps: number;
  weight: number;
  date: string;
};

/** Best weight for each rep count (rep-max PRs) for an exercise. */
export async function getExercisePRs(
  exerciseId: number,
  userId: number,
): Promise<ExercisePR[]> {
  const rows = await db
    .select({
      reps: loggedSets.reps,
      weight: sql<string>`max(${loggedSets.weight})`.as("w"),
    })
    .from(loggedSets)
    .innerJoin(
      workoutExercises,
      eq(workoutExercises.id, loggedSets.workoutExerciseId),
    )
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        eq(loggedSets.completed, true),
        eq(workouts.userId, userId),
      ),
    )
    .groupBy(loggedSets.reps)
    .orderBy(asc(loggedSets.reps));

  const out: ExercisePR[] = [];
  for (const r of rows) {
    const weight = num(r.weight);
    const dateRow = await db
      .select({ date: workouts.date })
      .from(loggedSets)
      .innerJoin(
        workoutExercises,
        eq(workoutExercises.id, loggedSets.workoutExerciseId),
      )
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(
        and(
          eq(workoutExercises.exerciseId, exerciseId),
          eq(loggedSets.reps, r.reps),
          eq(loggedSets.weight, weight.toFixed(2)),
          eq(workouts.userId, userId),
        ),
      )
      .orderBy(asc(workouts.date))
      .limit(1);
    out.push({ reps: r.reps, weight, date: dateRow[0]?.date ?? "" });
  }
  return out;
}

/** All exercises in the (shared, global) catalog. */
export async function getExercises() {
  return db.select().from(exercises).orderBy(asc(exercises.name));
}

// ---------- Dashboard ----------

export type WorkoutDateStatus = { date: string; status: string };

/** Every workout's date + status for a user (used by the month calendar). */
export async function getAllWorkoutDates(
  userId: number,
): Promise<WorkoutDateStatus[]> {
  const rows = await db
    .select({ date: workouts.date, status: workouts.status })
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(asc(workouts.date));
  return rows;
}

export type ConsistencyDay = { date: string; status: "done" | "missed" | "none" };

/** Per-day completion since `sinceISO` for the consistency heatmap. */
export async function getConsistency(
  sinceISO: string,
  userId: number,
): Promise<ConsistencyDay[]> {
  const rows = await db
    .select({ date: workouts.date, status: workouts.status })
    .from(workouts)
    .where(and(gte(workouts.date, sinceISO), eq(workouts.userId, userId)))
    .orderBy(asc(workouts.date));
  return rows.map((r) => ({
    date: r.date,
    status: r.status === "complete" ? "done" : r.status === "skipped" ? "missed" : "none",
  }));
}

export type TonnagePoint = { date: string } & Record<string, number | string>;

/** Stacked tonnage per session since a date, split by exercise. */
export async function getTonnage(
  sinceISO: string,
  userId: number,
): Promise<{ points: TonnagePoint[]; exercises: string[] }> {
  const rows = await db
    .select({
      date: workouts.date,
      name: exercises.name,
      tonnage: sql<string>`sum(${loggedSets.weight} * ${loggedSets.reps})`.as("t"),
    })
    .from(loggedSets)
    .innerJoin(
      workoutExercises,
      eq(workoutExercises.id, loggedSets.workoutExerciseId),
    )
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        gte(workouts.date, sinceISO),
        eq(loggedSets.completed, true),
        eq(workouts.userId, userId),
      ),
    )
    .groupBy(workouts.date, exercises.name)
    .orderBy(asc(workouts.date));

  const exSet = new Set<string>();
  const byDate = new Map<string, TonnagePoint>();
  for (const r of rows) {
    exSet.add(r.name);
    if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date });
    const point = byDate.get(r.date)!;
    point[r.name] = Math.round(num(r.tonnage));
  }
  return { points: [...byDate.values()], exercises: [...exSet] };
}

export type TrendPoint = { date: string } & Record<string, number | string>;

/** Estimated-1RM of the top set per session, per exercise, for the trend chart. */
export async function getStrengthTrend(
  sinceISO: string,
  userId: number,
): Promise<{ points: TrendPoint[]; exercises: string[] }> {
  const rows = await db
    .select({
      date: workouts.date,
      name: exercises.name,
      weId: workoutExercises.id,
      reps: loggedSets.reps,
      weight: loggedSets.weight,
    })
    .from(loggedSets)
    .innerJoin(
      workoutExercises,
      eq(workoutExercises.id, loggedSets.workoutExerciseId),
    )
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        gte(workouts.date, sinceISO),
        eq(loggedSets.completed, true),
        eq(workouts.userId, userId),
      ),
    )
    .orderBy(asc(workouts.date));

  // best e1RM per session (workout-exercise)
  const perSession = new Map<
    number,
    { date: string; name: string; e1rm: number }
  >();
  for (const r of rows) {
    const e = epley1RM(num(r.weight), r.reps);
    if (e <= 0) continue; // skip bodyweight / unweighted movements
    const cur = perSession.get(r.weId);
    if (!cur || e > cur.e1rm)
      perSession.set(r.weId, { date: r.date, name: r.name, e1rm: e });
  }

  const exSet = new Set<string>();
  const byDate = new Map<string, TrendPoint>();
  for (const s of perSession.values()) {
    exSet.add(s.name);
    if (!byDate.has(s.date)) byDate.set(s.date, { date: s.date });
    byDate.get(s.date)![s.name] = Math.round(s.e1rm);
  }
  const points = [...byDate.values()].sort((a, b) =>
    (a.date as string).localeCompare(b.date as string),
  );
  return { points, exercises: [...exSet] };
}

/** Count of completed workouts for a user (athlete header). */
export async function getCompletedCount(userId: number): Promise<number> {
  const rows = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "complete")));
  return rows.length;
}
