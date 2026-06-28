import { eq } from "drizzle-orm";
import { db } from "./index";
import { coachProfile, coachMemories } from "./schema";

/**
 * Idempotent seed for the AI coach: ensures the singleton profile (id=1)
 * exists with a starter persona + program config, and seeds the known
 * athlete memories if none exist yet.
 */

const STARTER_PERSONA = `You are Hank, a veteran strength coach in the Starting Strength tradition.

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
- Adapt around limitations creatively (substitute lifts) rather than forcing contraindicated movements.`;

const DEFAULT_PROGRAM_CONFIG = {
  daysOfWeek: [1, 3, 5], // Mon / Wed / Fri
  lifts: ["Squat", "Press", "Deadlift"],
  increments: { Squat: 5, Press: 2.5, Deadlift: 5, "Romanian Deadlift": 5 },
  caps: { Squat: 230 },
  excluded: ["Bench Press"],
};

const MEMORIES: { kind: string; content: string; pinned: boolean }[] = [
  {
    kind: "injury",
    content:
      "Osteoarthritis in the right shoulder. Cannot do traditional barbell bench press and upper-body pressing is limited. Prefer shoulder-friendly options (neutral-grip / football/swiss bar, landmine press, dumbbell variations) only as tolerated — never push through shoulder pain.",
    pinned: true,
  },
  {
    kind: "constraint",
    content:
      "Back tends to get injured when squatting heavy (around 240+ lb). Keep working squats capped near 230 lb, prioritize clean form, and avoid grinding heavy singles.",
    pinned: true,
  },
  {
    kind: "note",
    content:
      "Turning 56. Program with age-appropriate recovery: smaller weight increments, adequate rest, and no pushing into injury territory for the sake of the number.",
    pinned: true,
  },
];

async function main() {
  const existing = await db
    .select()
    .from(coachProfile)
    .where(eq(coachProfile.id, 1));

  if (existing.length === 0) {
    await db.insert(coachProfile).values({
      id: 1,
      name: "Hank",
      persona: STARTER_PERSONA,
      programConfig: DEFAULT_PROGRAM_CONFIG,
    });
    console.log("Inserted coach profile.");
  } else {
    console.log("Coach profile already exists — leaving it untouched.");
  }

  const mems = await db.select().from(coachMemories);
  if (mems.length === 0) {
    await db.insert(coachMemories).values(MEMORIES);
    console.log(`Inserted ${MEMORIES.length} starter memories.`);
  } else {
    console.log(`Memories already present (${mems.length}) — leaving untouched.`);
  }

  console.log("Coach seed complete ✅");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
