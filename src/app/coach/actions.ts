"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coachProfile, coachMemories, blackoutDays } from "@/db/schema";
import { runChat, clearTranscript, type ChatResult } from "@/lib/coach/chat";
import { runDailyTick, sendTest, type TickReport } from "@/lib/coach/reminders";
import { ensureScheduled } from "@/lib/coach/program";
import { getCoachProfile } from "@/lib/coach/context";
import { clearCoachWorkoutsInRange } from "@/lib/coach/blackouts";

export async function sendCoachMessage(text: string): Promise<ChatResult> {
  return runChat(text);
}

export async function clearCoachChat() {
  await clearTranscript();
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

export async function updateCoachProfile(patch: ProfilePatch) {
  await db
    .update(coachProfile)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(coachProfile.id, 1));
  revalidatePath("/coach");
  revalidatePath("/coach/settings");
}

export async function addCoachMemory(kind: string, content: string) {
  if (!content.trim()) return;
  await db.insert(coachMemories).values({ kind, content: content.trim() });
  revalidatePath("/coach/settings");
}

export async function updateCoachMemory(
  id: number,
  data: { kind: string; content: string; pinned?: boolean },
) {
  await db
    .update(coachMemories)
    .set({ kind: data.kind, content: data.content.trim(), pinned: data.pinned })
    .where(eq(coachMemories.id, id));
  revalidatePath("/coach/settings");
}

export async function deleteCoachMemory(id: number) {
  await db.delete(coachMemories).where(eq(coachMemories.id, id));
  revalidatePath("/coach/settings");
}

export async function sendTestEmail(
  kind: "digest" | "reminder",
): Promise<{ ok: boolean; error?: string }> {
  return sendTest(kind);
}

export async function runCoachTick(): Promise<TickReport> {
  return runDailyTick({ force: true });
}

// ---- blackout days ----
export async function addBlackout(
  startDate: string,
  endDate: string,
  reason: string,
) {
  if (!startDate || !endDate) return;
  const [a, b] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  await db
    .insert(blackoutDays)
    .values({ startDate: a, endDate: b, reason: reason.trim() || null });
  await clearCoachWorkoutsInRange(a, b);
  revalidatePath("/coach/settings");
  revalidatePath("/calendar");
}

export async function deleteBlackout(id: number) {
  await db.delete(blackoutDays).where(eq(blackoutDays.id, id));
  revalidatePath("/coach/settings");
  revalidatePath("/calendar");
}

export async function updateProgramConfig(
  patch: Record<string, unknown>,
): Promise<void> {
  const [p] = await db.select().from(coachProfile).where(eq(coachProfile.id, 1));
  const current = (p?.programConfig as Record<string, unknown>) ?? {};
  await db
    .update(coachProfile)
    .set({ programConfig: { ...current, ...patch }, updatedAt: new Date() })
    .where(eq(coachProfile.id, 1));
  revalidatePath("/coach/settings");
  revalidatePath("/calendar");
}

export async function programUpcoming(): Promise<{ created: number }> {
  const profile = await getCoachProfile();
  const created = await ensureScheduled(profile, 14);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { created: created.length };
}
