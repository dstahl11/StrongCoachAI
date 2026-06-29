import { NextResponse } from "next/server";
import { getExerciseHistory, getExercisePRs } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    getExerciseHistory(exerciseId, user.id),
    getExercisePRs(exerciseId, user.id),
  ]);
  return NextResponse.json({ name: ex?.name ?? "Exercise", history, prs });
}
