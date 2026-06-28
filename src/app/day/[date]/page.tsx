import { getWorkoutByDate, getExercises } from "@/lib/queries";
import { shiftISO } from "@/lib/dates";
import { epley1RM } from "@/lib/strength";
import WorkoutDay from "@/components/WorkoutDay";

export const dynamic = "force-dynamic";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const workout = await getWorkoutByDate(date);
  const exercises = await getExercises();

  // Per-exercise top set + estimated 1RM (for the PRs / Estimated 1RMs panels)
  const summary =
    workout?.exercises
      .filter((we) => !we.skipped)
      .map((we) => {
        const sets = we.loggedSets.length
          ? we.loggedSets
          : we.setGroups.flatMap((g) =>
              Array.from({ length: g.sets }, () => ({
                reps: g.reps,
                weight: g.weight,
              })),
            );
        let top = { reps: 0, weight: 0, e1rm: 0 };
        let count = 0;
        let topWeight = -1;
        for (const s of sets) {
          count++;
          if (s.weight > topWeight) {
            topWeight = s.weight;
            top = {
              reps: s.reps,
              weight: s.weight,
              e1rm: Math.round(epley1RM(s.weight, s.reps) * 10) / 10,
            };
          }
        }
        return {
          name: we.exercise.name,
          sets: count,
          reps: top.reps,
          weight: top.weight,
          e1rm: top.e1rm,
        };
      }) ?? [];

  return (
    <WorkoutDay
      date={date}
      prev={shiftISO(date, -1)}
      next={shiftISO(date, 1)}
      workout={workout}
      summary={summary}
      exercises={exercises.map((e) => ({ id: e.id, name: e.name }))}
    />
  );
}
