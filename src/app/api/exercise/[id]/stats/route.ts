import { NextResponse } from "next/server";
import { getExerciseHistory, getExercisePRs } from "@/lib/queries";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const exerciseId = Number(id);
  if (!Number.isFinite(exerciseId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const [ex] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .limit(1);
  const [history, prs] = await Promise.all([
    getExerciseHistory(exerciseId),
    getExercisePRs(exerciseId),
  ]);
  return NextResponse.json({ name: ex?.name ?? "Exercise", history, prs });
}
