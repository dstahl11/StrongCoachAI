import "server-only";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  exercises,
  workouts,
  workoutExercises,
  setGroups,
  coachMemories,
  coachProfile,
  blackoutDays,
} from "@/db/schema";
import { getTrainingSummary, getCoachProfile } from "./context";
import { ensureScheduled } from "./program";
import { clearCoachWorkoutsInRange } from "./blackouts";

/** OpenAI-style tool schemas (Portkey maps these to Anthropic tool use). */
export const TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "get_training_summary",
      description:
        "Get the athlete's current training snapshot: recent sessions, current working weights, days since last workout, upcoming and missed sessions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "schedule_workout",
      description:
        "Create or replace a planned workout on a given date. Use concrete weights that respect the athlete's caps and exclusions. Replaces an existing upcoming workout on that date; refuses to overwrite a completed one.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                sets: { type: "integer" },
                reps: { type: "integer" },
                weight: { type: "number", description: "lb; 0 for bodyweight" },
              },
              required: ["name", "sets", "reps", "weight"],
            },
          },
        },
        required: ["date", "exercises"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "remember",
      description:
        "Save a durable fact about the athlete (injury, constraint, preference, goal, or note) so it informs future coaching and programming.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["injury", "constraint", "preference", "goal", "note"],
          },
          content: { type: "string" },
        },
        required: ["kind", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "forget",
      description: "Delete a saved memory by its id.",
      parameters: {
        type: "object",
        properties: { id: { type: "integer" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_program_config",
      description:
        "Update the athlete's programming configuration (training days of week / split, lifts in rotation, per-lift increments, weight caps, excluded lifts). Merges into existing config and changes future autonomous programming.",
      parameters: {
        type: "object",
        properties: {
          daysOfWeek: {
            type: "array",
            items: { type: "integer" },
            description: "0=Sun..6=Sat training days",
          },
          lifts: { type: "array", items: { type: "string" } },
          excluded: { type: "array", items: { type: "string" } },
          increments: { type: "object", description: "{ liftName: lbPerSession }" },
          caps: { type: "object", description: "{ liftName: maxLb }" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_blackout",
      description:
        "Mark a date range as a blackout (travel / unavailable). The coach won't program workouts on these days and won't count them as missed. Dates inclusive.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "ISO YYYY-MM-DD" },
          endDate: { type: "string", description: "ISO YYYY-MM-DD (same as start for one day)" },
          reason: { type: "string" },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "clear_blackout",
      description: "Remove a blackout range by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "integer" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "program_upcoming",
      description:
        "Autonomously fill in the athlete's upcoming training days with progressed Starting Strength sessions (respecting caps, exclusions, and blackout days). Use when asked to 'program my week' or plan ahead.",
      parameters: {
        type: "object",
        properties: {
          daysAhead: { type: "integer", description: "how many days ahead to fill (default 14)" },
        },
      },
    },
  },
];

async function resolveExerciseId(name: string): Promise<number> {
  const trimmed = name.trim();
  const existing = await db.select().from(exercises);
  const found = existing.find(
    (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (found) return found.id;
  const [created] = await db
    .insert(exercises)
    .values({ name: trimmed })
    .returning();
  return created.id;
}

type ScheduleArgs = {
  date: string;
  exercises: { name: string; sets: number; reps: number; weight: number }[];
};

async function scheduleWorkout(args: ScheduleArgs) {
  const existing = await db.query.workouts.findFirst({
    where: eq(workouts.date, args.date),
  });
  if (existing && existing.status === "complete") {
    return { ok: false, message: `${args.date} is already completed; not overwriting.` };
  }

  let workoutId: number;
  if (existing) {
    workoutId = existing.id;
    // clear current exercises before re-planning
    await db.delete(workoutExercises).where(eq(workoutExercises.workoutId, workoutId));
    await db
      .update(workouts)
      .set({ source: "coach" })
      .where(eq(workouts.id, workoutId));
  } else {
    const [wo] = await db
      .insert(workouts)
      .values({ date: args.date, title: "Workout", status: "upcoming", source: "coach" })
      .returning();
    workoutId = wo.id;
  }

  let position = 0;
  for (const ex of args.exercises) {
    const exerciseId = await resolveExerciseId(ex.name);
    const [we] = await db
      .insert(workoutExercises)
      .values({ workoutId, exerciseId, position: position++ })
      .returning();
    await db.insert(setGroups).values({
      workoutExerciseId: we.id,
      position: 0,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight.toFixed(2),
    });
  }

  revalidatePath("/calendar");
  revalidatePath(`/day/${args.date}`);
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Scheduled ${args.exercises.length} exercise(s) on ${args.date}.`,
  };
}

async function mergeProgramConfig(patch: Record<string, unknown>) {
  const [p] = await db.select().from(coachProfile).where(eq(coachProfile.id, 1));
  const current = (p?.programConfig as Record<string, unknown>) ?? {};
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (
      (k === "increments" || k === "caps") &&
      typeof v === "object" &&
      v !== null
    ) {
      next[k] = { ...((current[k] as object) ?? {}), ...(v as object) };
    } else {
      next[k] = v;
    }
  }
  await db
    .update(coachProfile)
    .set({ programConfig: next, updatedAt: new Date() })
    .where(eq(coachProfile.id, 1));
  revalidatePath("/coach/settings");
  return { ok: true, message: "Program config updated.", config: next };
}

/** Execute a tool call by name. Returns a JSON-serializable result. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_training_summary":
      return getTrainingSummary();

    case "schedule_workout":
      return scheduleWorkout(args as unknown as ScheduleArgs);

    case "remember": {
      const [m] = await db
        .insert(coachMemories)
        .values({
          kind: String(args.kind ?? "note"),
          content: String(args.content ?? "").trim(),
        })
        .returning();
      revalidatePath("/coach/settings");
      return { ok: true, id: m.id, message: "Saved to memory." };
    }

    case "forget": {
      await db
        .delete(coachMemories)
        .where(eq(coachMemories.id, Number(args.id)));
      revalidatePath("/coach/settings");
      return { ok: true, message: "Memory removed." };
    }

    case "update_program_config":
      return mergeProgramConfig(args);

    case "set_blackout": {
      const start = String(args.startDate);
      const end = String(args.endDate ?? args.startDate);
      const [b] = await db
        .insert(blackoutDays)
        .values({
          startDate: start,
          endDate: end,
          reason: args.reason ? String(args.reason) : null,
        })
        .returning();
      const cleared = await clearCoachWorkoutsInRange(start, end);
      revalidatePath("/calendar");
      revalidatePath("/coach/settings");
      return {
        ok: true,
        id: b.id,
        clearedSessions: cleared,
        message: `Blackout saved.${cleared ? ` Cleared ${cleared} programmed session(s) in that range.` : ""}`,
      };
    }

    case "clear_blackout": {
      await db.delete(blackoutDays).where(eq(blackoutDays.id, Number(args.id)));
      revalidatePath("/calendar");
      revalidatePath("/coach/settings");
      return { ok: true, message: "Blackout removed." };
    }

    case "program_upcoming": {
      const profile = await getCoachProfile();
      const created = await ensureScheduled(
        profile,
        Number(args.daysAhead) || 14,
      );
      revalidatePath("/calendar");
      return {
        ok: true,
        created: created.map((c) => ({ date: c.date, exercises: c.exercises })),
        message: created.length
          ? `Programmed ${created.length} session(s).`
          : "Nothing to add — upcoming days are already planned or blacked out.",
      };
    }

    default:
      return { ok: false, message: `Unknown tool: ${name}` };
  }
}
