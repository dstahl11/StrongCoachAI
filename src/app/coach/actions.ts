"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { coachProfile, coachMemories, blackoutDays } from "@/db/schema";
import { runChat, clearTranscript, type ChatResult } from "@/lib/coach/chat";
import { sendTest, runUserTick, type TickReport } from "@/lib/coach/reminders";
import { ensureScheduled } from "@/lib/coach/program";
import { getCoachProfile } from "@/lib/coach/context";
import { ensureCoachProfile } from "@/lib/coach/template";
import { clearCoachWorkoutsInRange } from "@/lib/coach/blackouts";
import { requireUser, requireAdmin } from "@/lib/auth/current-user";

/** Resolve the user an action targets: self by default; admins may act on others. */
async function actingUserId(targetUserId?: number): Promise<number> {
  const me = await requireUser();
  if (targetUserId == null || targetUserId === me.id) return me.id;
  await requireAdmin();
  return targetUserId;
}

export async function sendCoachMessage(text: string): Promise<ChatResult> {
  const me = await requireUser();
  return runChat(me.id, text);
}

export async function clearCoachChat() {
  const me = await requireUser();
  await clearTranscript(me.id);
}

type ProfilePatch = {
  name?: string;
  persona?: string;
  model?: string;
  remindersEnabled?: boolean;
  digestEnabled?: boolean;
  reminderEmail?: string | null;
  missedGraceDays?: number;
  inactivityDays?: number;
  digestHour?: number;
  autonomousProgramming?: boolean;
};

export async function updateCoachProfile(
  patch: ProfilePatch,
  targetUserId?: number,
) {
  const uid = await actingUserId(targetUserId);
  await ensureCoachProfile(uid);
  await db
    .update(coachProfile)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(coachProfile.userId, uid));
  revalidatePath("/coach");
  revalidatePath("/coach/settings");
}

export async function addCoachMemory(
  kind: string,
  content: string,
  targetUserId?: number,
) {
  if (!content.trim()) return;
  const uid = await actingUserId(targetUserId);
  await db.insert(coachMemories).values({ userId: uid, kind, content: content.trim() });
  revalidatePath("/coach/settings");
}

export async function updateCoachMemory(
  id: number,
  data: { kind: string; content: string; pinned?: boolean },
  targetUserId?: number,
) {
  const uid = await actingUserId(targetUserId);
  await db
    .update(coachMemories)
    .set({ kind: data.kind, content: data.content.trim(), pinned: data.pinned })
    .where(and(eq(coachMemories.id, id), eq(coachMemories.userId, uid)));
  revalidatePath("/coach/settings");
}

export async function deleteCoachMemory(id: number, targetUserId?: number) {
  const uid = await actingUserId(targetUserId);
  await db
    .delete(coachMemories)
    .where(and(eq(coachMemories.id, id), eq(coachMemories.userId, uid)));
  revalidatePath("/coach/settings");
}

export async function sendTestEmail(
  kind: "digest" | "reminder",
  targetUserId?: number,
): Promise<{ ok: boolean; error?: string }> {
  const uid = await actingUserId(targetUserId);
  return sendTest(kind, uid);
}

export async function runCoachTick(targetUserId?: number): Promise<TickReport> {
  const uid = await actingUserId(targetUserId);
  const profile = await getCoachProfile(uid);
  return runUserTick(profile, { force: true });
}

// ---- blackout days ----
export async function addBlackout(
  startDate: string,
  endDate: string,
  reason: string,
  targetUserId?: number,
) {
  if (!startDate || !endDate) return;
  const uid = await actingUserId(targetUserId);
  const [a, b] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  await db
    .insert(blackoutDays)
    .values({ userId: uid, startDate: a, endDate: b, reason: reason.trim() || null });
  await clearCoachWorkoutsInRange(a, b, uid);
  revalidatePath("/coach/settings");
  revalidatePath("/calendar");
}

export async function deleteBlackout(id: number, targetUserId?: number) {
  const uid = await actingUserId(targetUserId);
  await db
    .delete(blackoutDays)
    .where(and(eq(blackoutDays.id, id), eq(blackoutDays.userId, uid)));
  revalidatePath("/coach/settings");
  revalidatePath("/calendar");
}

export async function updateProgramConfig(
  patch: Record<string, unknown>,
  targetUserId?: number,
): Promise<void> {
  const uid = await actingUserId(targetUserId);
  const profile = await ensureCoachProfile(uid);
  const current = (profile.programConfig as Record<string, unknown>) ?? {};
  await db
    .update(coachProfile)
    .set({ programConfig: { ...current, ...patch }, updatedAt: new Date() })
    .where(eq(coachProfile.userId, uid));
  revalidatePath("/coach/settings");
  revalidatePath("/calendar");
}

export async function programUpcoming(
  targetUserId?: number,
): Promise<{ created: number }> {
  const uid = await actingUserId(targetUserId);
  const profile = await getCoachProfile(uid);
  const created = await ensureScheduled(profile, 14);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { created: created.length };
}
