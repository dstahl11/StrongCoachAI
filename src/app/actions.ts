"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  workouts,
  workoutExercises,
  setGroups,
  loggedSets,
  exercises,
} from "@/db/schema";
import { fromISO } from "@/lib/dates";
import { requireUser } from "@/lib/auth/current-user";

function revalidate(date?: string) {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  if (date) revalidatePath(`/day/${date}`);
}

async function currentUserId(): Promise<number> {
  return (await requireUser()).id;
}

// ---- ownership guards (throw if the row isn't the user's) ----
async function assertOwnsWorkout(workoutId: number, uid: number) {
  const [w] = await db
    .select({ userId: workouts.userId })
    .from(workouts)
    .where(eq(workouts.id, workoutId));
  if (!w || w.userId !== uid) throw new Error("Not found.");
}
async function assertOwnsWorkoutExercise(weId: number, uid: number) {
  const [w] = await db
    .select({ userId: workouts.userId })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(eq(workoutExercises.id, weId));
  if (!w || w.userId !== uid) throw new Error("Not found.");
}
async function assertOwnsSetGroup(sgId: number, uid: number) {
  const [w] = await db
    .select({ userId: workouts.userId })
    .from(setGroups)
    .innerJoin(workoutExercises, eq(workoutExercises.id, setGroups.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(eq(setGroups.id, sgId));
  if (!w || w.userId !== uid) throw new Error("Not found.");
}

/** Mark a workout complete. Materializes logged sets from the prescription
 *  for any exercise that has none yet. */
export async function markWorkoutComplete(workoutId: number, date: string) {
  const uid = await currentUserId();
  await assertOwnsWorkout(workoutId, uid);
  const wes = await db.query.workoutExercises.findMany({
    where: eq(workoutExercises.workoutId, workoutId),
    with: { setGroups: true, loggedSets: true },
  });

  for (const we of wes) {
    if (we.skipped) continue;
    if (we.loggedSets.length > 0) continue;
    let n = 1;
    const rows = [];
    for (const g of we.setGroups) {
      if (g.isWarmup) continue;
      for (let i = 0; i < g.sets; i++) {
        rows.push({
          workoutExerciseId: we.id,
          setGroupId: g.id,
          setNumber: n++,
          reps: g.reps,
          weight: g.weight,
          completed: true,
        });
      }
    }
    if (rows.length) await db.insert(loggedSets).values(rows);
  }

  await db
    .update(workouts)
    .set({ status: "complete", completedAt: fromISO(date) })
    .where(eq(workouts.id, workoutId));
  revalidate(date);
}

export async function reopenWorkout(workoutId: number, date: string) {
  const uid = await currentUserId();
  await assertOwnsWorkout(workoutId, uid);
  await db
    .update(workouts)
    .set({ status: "upcoming", completedAt: null })
    .where(eq(workouts.id, workoutId));
  revalidate(date);
}

export async function setExerciseSkipped(
  workoutExerciseId: number,
  skipped: boolean,
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsWorkoutExercise(workoutExerciseId, uid);
  await db
    .update(workoutExercises)
    .set({ skipped })
    .where(eq(workoutExercises.id, workoutExerciseId));
  revalidate(date);
}

export async function saveExerciseComment(
  workoutExerciseId: number,
  comment: string,
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsWorkoutExercise(workoutExerciseId, uid);
  await db
    .update(workoutExercises)
    .set({ comment: comment.trim() || null })
    .where(eq(workoutExercises.id, workoutExerciseId));
  revalidate(date);
}

export async function saveExerciseVideo(
  workoutExerciseId: number,
  videoUrl: string,
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsWorkoutExercise(workoutExerciseId, uid);
  await db
    .update(workoutExercises)
    .set({ videoUrl: videoUrl.trim() || null })
    .where(eq(workoutExercises.id, workoutExerciseId));
  revalidate(date);
}

export async function saveWorkoutComment(
  workoutId: number,
  notes: string,
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsWorkout(workoutId, uid);
  await db
    .update(workouts)
    .set({ notes: notes.trim() || null })
    .where(eq(workouts.id, workoutId));
  revalidate(date);
}

/** Replace the logged sets for one exercise with the provided list. */
export async function saveLoggedSets(
  workoutExerciseId: number,
  sets: { reps: number; weight: number; completed: boolean }[],
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsWorkoutExercise(workoutExerciseId, uid);
  await db
    .delete(loggedSets)
    .where(eq(loggedSets.workoutExerciseId, workoutExerciseId));
  if (sets.length) {
    await db.insert(loggedSets).values(
      sets.map((s, i) => ({
        workoutExerciseId,
        setNumber: i + 1,
        reps: s.reps,
        weight: s.weight.toFixed(2),
        completed: s.completed,
      })),
    );
  }
  revalidate(date);
}

/** Update a prescription set-line. */
export async function updateSetGroup(
  setGroupId: number,
  data: { sets: number; reps: number; weight: number },
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsSetGroup(setGroupId, uid);
  await db
    .update(setGroups)
    .set({ sets: data.sets, reps: data.reps, weight: data.weight.toFixed(2) })
    .where(eq(setGroups.id, setGroupId));
  revalidate(date);
}

export async function deleteSetGroup(setGroupId: number, date: string) {
  const uid = await currentUserId();
  await assertOwnsSetGroup(setGroupId, uid);
  await db.delete(setGroups).where(eq(setGroups.id, setGroupId));
  revalidate(date);
}

// ---- Builder actions ----

export async function createWorkout(date: string) {
  const uid = await currentUserId();
  const existing = await db.query.workouts.findFirst({
    where: and(eq(workouts.date, date), eq(workouts.userId, uid)),
  });
  if (existing) return existing.id;
  const [wo] = await db
    .insert(workouts)
    .values({ userId: uid, date, title: "Workout", status: "upcoming" })
    .returning();
  revalidate(date);
  return wo.id;
}

export async function addExerciseToWorkout(
  workoutId: number,
  exerciseId: number,
  scheme: { sets: number; reps: number; weight: number },
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsWorkout(workoutId, uid);
  const count = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId));
  const [we] = await db
    .insert(workoutExercises)
    .values({ workoutId, exerciseId, position: count.length })
    .returning();
  await db.insert(setGroups).values({
    workoutExerciseId: we.id,
    position: 0,
    sets: scheme.sets,
    reps: scheme.reps,
    weight: scheme.weight.toFixed(2),
  });
  revalidate(date);
}

export async function addSetGroup(
  workoutExerciseId: number,
  scheme: { sets: number; reps: number; weight: number },
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsWorkoutExercise(workoutExerciseId, uid);
  const existing = await db
    .select({ position: setGroups.position })
    .from(setGroups)
    .where(eq(setGroups.workoutExerciseId, workoutExerciseId));
  await db.insert(setGroups).values({
    workoutExerciseId,
    position: existing.length,
    sets: scheme.sets,
    reps: scheme.reps,
    weight: scheme.weight.toFixed(2),
  });
  revalidate(date);
}

export async function removeWorkoutExercise(
  workoutExerciseId: number,
  date: string,
) {
  const uid = await currentUserId();
  await assertOwnsWorkoutExercise(workoutExerciseId, uid);
  await db
    .delete(workoutExercises)
    .where(eq(workoutExercises.id, workoutExerciseId));
  revalidate(date);
}

// ---- Exercise catalog (shared/global; any signed-in user may edit) ----

export async function createExercise(data: {
  name: string;
  demoUrl?: string;
  muscleGroup?: string;
}) {
  await requireUser();
  const [ex] = await db
    .insert(exercises)
    .values({
      name: data.name.trim(),
      demoUrl: data.demoUrl?.trim() || null,
      muscleGroup: data.muscleGroup?.trim() || null,
    })
    .returning();
  revalidatePath("/exercises");
  return ex.id;
}

export async function updateExercise(
  id: number,
  data: { name: string; demoUrl?: string; muscleGroup?: string },
) {
  await requireUser();
  await db
    .update(exercises)
    .set({
      name: data.name.trim(),
      demoUrl: data.demoUrl?.trim() || null,
      muscleGroup: data.muscleGroup?.trim() || null,
    })
    .where(eq(exercises.id, id));
  revalidatePath("/exercises");
}

/** Delete an exercise. Blocked (with a count) if it's used in any workout,
 *  unless `force` is set — then its workout history is removed too. */
export async function deleteExercise(
  id: number,
  force = false,
): Promise<{ ok: boolean; usedIn?: number }> {
  await requireUser();
  const refs = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .where(eq(workoutExercises.exerciseId, id));

  if (refs.length > 0 && !force) {
    return { ok: false, usedIn: refs.length };
  }
  if (refs.length > 0 && force) {
    for (const r of refs) {
      await db
        .delete(workoutExercises)
        .where(eq(workoutExercises.id, r.id));
    }
  }
  await db.delete(exercises).where(eq(exercises.id, id));
  revalidatePath("/exercises");
  revalidatePath("/dashboard");
  return { ok: true };
}
