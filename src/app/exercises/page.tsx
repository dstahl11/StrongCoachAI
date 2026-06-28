import { getExercises } from "@/lib/queries";
import ExerciseLibrary from "@/components/ExerciseLibrary";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await getExercises();
  return (
    <ExerciseLibrary
      exercises={exercises.map((e) => ({
        id: e.id,
        name: e.name,
        demoUrl: e.demoUrl,
        muscleGroup: e.muscleGroup,
      }))}
    />
  );
}
