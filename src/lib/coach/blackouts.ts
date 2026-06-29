import "server-only";
import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { blackoutDays, workouts, type BlackoutDay } from "@/db/schema";

export async function getBlackouts(userId: number): Promise<BlackoutDay[]> {
  return db
    .select()
    .from(blackoutDays)
    .where(eq(blackoutDays.userId, userId))
    .orderBy(asc(blackoutDays.startDate));
}

/** Remove auto-programmed (coach, not-completed) workouts inside a date range,
 *  e.g. when the athlete blacks out travel days. Returns how many were cleared. */
export async function clearCoachWorkoutsInRange(
  start: string,
  end: string,
  userId: number,
): Promise<number> {
  const rows = await db
    .delete(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workouts.source, "coach"),
        ne(workouts.status, "complete"),
        gte(workouts.date, start),
        lte(workouts.date, end),
      ),
    )
    .returning({ id: workouts.id });
  return rows.length;
}

export function blackoutFor(
  date: string,
  ranges: { startDate: string; endDate: string; reason: string | null }[],
) {
  return ranges.find((r) => date >= r.startDate && date <= r.endDate) ?? null;
}
