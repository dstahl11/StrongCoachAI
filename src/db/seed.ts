import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  exercises,
  workouts,
  workoutExercises,
  setGroups,
  loggedSets,
} from "./schema";

/**
 * Seed a realistic ~16 week training history so the dashboard charts,
 * PRs, and stats & history views have meaningful data. Idempotent: wipes
 * the tables first. "Today" is anchored to 2026-06-27 to match the demo.
 */

const TODAY = new Date("2026-06-27T12:00:00");

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// round to nearest 2.5 lb
function round25(w: number) {
  return Math.round(w / 2.5) * 2.5;
}

type Movement = {
  name: string;
  demoUrl: string | null;
  muscleGroup: string;
  // weight at week 0 for the working scheme, and weekly increment
  start: number;
  inc: number;
  scheme: { sets: number; reps: number; pct?: number };
  // which weekday slots (0=Mon session,1,2) this lift appears in
  days: number[];
};

const PROGRAM: Movement[] = [
  {
    name: "Safety Squat Bar Squat",
    demoUrl: "https://www.youtube.com/watch?v=hCRbg2-Smjg",
    muscleGroup: "Legs",
    start: 155,
    inc: 5,
    scheme: { sets: 4, reps: 5 },
    days: [0, 2],
  },
  {
    name: "Bench Press Multi-Grip/Swiss/Football Bar",
    demoUrl: "https://www.youtube.com/watch?v=rT7DgCr-3pg",
    muscleGroup: "Chest",
    start: 150,
    inc: 2.5,
    scheme: { sets: 3, reps: 3 },
    days: [0],
  },
  {
    name: "Deadlift",
    demoUrl: "https://www.youtube.com/watch?v=op9kVnSso6Q",
    muscleGroup: "Back",
    start: 285,
    inc: 5,
    scheme: { sets: 1, reps: 5 },
    days: [2],
  },
  {
    name: "Romanian Deadlift",
    demoUrl: "https://www.youtube.com/watch?v=JCXUYuzwNrM",
    muscleGroup: "Hamstrings",
    start: 115,
    inc: 2.5,
    scheme: { sets: 3, reps: 8 },
    days: [1],
  },
  {
    name: "Straight Leg Deadlift",
    demoUrl: "https://www.youtube.com/watch?v=Y1IGeJEpwGU",
    muscleGroup: "Hamstrings",
    start: 185,
    inc: 2.5,
    scheme: { sets: 3, reps: 5 },
    days: [1],
  },
  {
    name: "Dumbbell Incline Bench",
    demoUrl: "https://www.youtube.com/watch?v=8iPEnn-ltC8",
    muscleGroup: "Chest",
    start: 40,
    inc: 1.25,
    scheme: { sets: 3, reps: 9 },
    days: [1, 2],
  },
];

const WEEKS = 16;
// session weekdays: Mon, Wed, Fri  -> offsets within a week
const SESSION_OFFSETS = [0, 2, 4];

async function main() {
  console.log("Clearing tables…");
  await db.delete(loggedSets);
  await db.delete(setGroups);
  await db.delete(workoutExercises);
  await db.delete(workouts);
  await db.delete(exercises);

  // Insert exercises
  console.log("Inserting exercises…");
  const exRows = await db
    .insert(exercises)
    .values(
      PROGRAM.map((m) => ({
        name: m.name,
        demoUrl: m.demoUrl,
        muscleGroup: m.muscleGroup,
      })),
    )
    .returning();
  const exId = new Map(exRows.map((e) => [e.name, e.id]));

  // Find the Monday on/just before (TODAY - WEEKS weeks)
  const start = addDays(TODAY, -(WEEKS - 1) * 7);
  // back up to Monday
  const startMonday = addDays(start, -((start.getDay() + 6) % 7));

  console.log("Generating workouts…");
  for (let w = 0; w < WEEKS; w++) {
    for (let s = 0; s < SESSION_OFFSETS.length; s++) {
      const d = addDays(startMonday, w * 7 + SESSION_OFFSETS[s]);
      if (d > TODAY) continue;
      const isToday = dateStr(d) === dateStr(TODAY);
      const isFuture = d > TODAY;

      // Which movements train on this session slot s?
      const moves = PROGRAM.filter((m) => m.days.includes(s));
      if (moves.length === 0) continue;

      const status = isToday || isFuture ? "upcoming" : "complete";
      const [wo] = await db
        .insert(workouts)
        .values({
          date: dateStr(d),
          title: "Workout",
          status,
          completedAt: status === "complete" ? d : null,
        })
        .returning();

      let pos = 0;
      for (const m of moves) {
        // small deload waves every 5th week to make charts interesting
        const wave = w % 5 === 4 ? -0.12 : 0;
        const base = m.start + m.inc * w;
        const weight = round25(base * (1 + wave));

        const [we] = await db
          .insert(workoutExercises)
          .values({
            workoutId: wo.id,
            exerciseId: exId.get(m.name)!,
            position: pos,
          })
          .returning();

        await db.insert(setGroups).values({
          workoutExerciseId: we.id,
          position: 0,
          sets: m.scheme.sets,
          reps: m.scheme.reps,
          weight: weight.toFixed(2),
        });

        // Log actual sets for completed sessions
        if (status === "complete") {
          const rows = [];
          for (let i = 0; i < m.scheme.sets; i++) {
            rows.push({
              workoutExerciseId: we.id,
              setNumber: i + 1,
              reps: m.scheme.reps,
              weight: weight.toFixed(2),
              completed: true,
            });
          }
          await db.insert(loggedSets).values(rows);
        }
        pos++;
      }
    }
  }

  // Ensure today's workout matches the live app exactly:
  // Safety Squat Bar Squat 4×5 @ 170, Deadlift 1×5 @ 180
  console.log("Setting today's workout…");
  // delete any auto-generated workout for today, then recreate it cleanly
  await db.delete(workouts).where(eq(workouts.date, dateStr(TODAY)));
  const [todayWo] = await db
    .insert(workouts)
    .values({ date: dateStr(TODAY), title: "Workout", status: "upcoming" })
    .returning();
  const todayPlan: Array<[string, number, number, number]> = [
    ["Safety Squat Bar Squat", 4, 5, 170],
    ["Deadlift", 1, 5, 180],
  ];
  let p = 0;
  for (const [name, sets, reps, weight] of todayPlan) {
    const [we] = await db
      .insert(workoutExercises)
      .values({
        workoutId: todayWo.id,
        exerciseId: exId.get(name)!,
        position: p++,
      })
      .returning();
    await db.insert(setGroups).values({
      workoutExerciseId: we.id,
      position: 0,
      sets,
      reps,
      weight: weight.toFixed(2),
    });
  }

  console.log("Seed complete ✅");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
