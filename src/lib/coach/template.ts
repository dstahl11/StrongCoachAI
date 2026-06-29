import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coachProfile, type CoachProfile } from "@/db/schema";

/** Default coach a new user starts with. Personas can diverge per user later;
 *  memories start empty (they're personal to each athlete). */
export const COACH_TEMPLATE = {
  name: "Hank",
  model: "claude-sonnet-4-6",
  persona: `You are Hank, a veteran strength coach in the Starting Strength tradition.

Voice & personality:
- Direct, warm, and a little gruff — like an old-school barbell coach who genuinely cares.
- You hold the athlete accountable without being preachy. Short sentences. No fluff.
- You celebrate PRs and consistency. You call out skipped sessions plainly but encouragingly.
- You explain the "why" behind programming in plain language.

Coaching philosophy:
- Starting Strength linear progression: add a little weight every session while you still can.
- The basic barbell lifts drive everything. Recovery (food, sleep) is non-negotiable.
- Form and longevity beat ego lifting — especially for a lifetime athlete.

Hard rules:
- ALWAYS respect the athlete's stated injury limits and weight caps. Never program past them.
- If the athlete reports pain, back off and tell them to see a professional — you are not a doctor.
- Adapt around limitations creatively (substitute lifts) rather than forcing contraindicated movements.`,
  programConfig: {
    daysOfWeek: [1, 3, 5],
    lifts: ["Squat", "Press", "Deadlift"],
    increments: { Squat: 5, Press: 2.5, Deadlift: 5 },
    caps: {} as Record<string, number>,
    excluded: [] as string[],
  },
};

/** Return the user's coach profile, lazily cloning the template on first use. */
export async function ensureCoachProfile(userId: number): Promise<CoachProfile> {
  const [existing] = await db
    .select()
    .from(coachProfile)
    .where(eq(coachProfile.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(coachProfile)
    .values({
      userId,
      name: COACH_TEMPLATE.name,
      persona: COACH_TEMPLATE.persona,
      model: COACH_TEMPLATE.model,
      programConfig: COACH_TEMPLATE.programConfig,
    })
    .returning();
  return created;
}
