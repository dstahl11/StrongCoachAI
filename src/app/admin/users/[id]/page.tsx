import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCoachProfile, getMemories } from "@/lib/coach/context";
import { getBlackouts } from "@/lib/coach/blackouts";
import { requireAdmin } from "@/lib/auth/current-user";
import CoachSettings from "@/components/CoachSettings";

export const dynamic = "force-dynamic";

type ProgramConfig = {
  daysOfWeek?: number[];
  caps?: Record<string, number>;
  excluded?: string[];
};

export default async function AdminUserCoachPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) notFound();

  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) notFound();

  const [profile, memories, blackouts] = await Promise.all([
    getCoachProfile(userId),
    getMemories(userId),
    getBlackouts(userId),
  ]);
  const pc = (profile.programConfig as ProgramConfig) ?? {};

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Back to users
      </Link>
      <div className="mt-2 rounded-xl bg-brand-50 px-4 py-2 text-sm text-brand-700">
        Editing the coach for{" "}
        <span className="font-semibold">{target.name || target.email}</span>.
      </div>
      <CoachSettings
        targetUserId={userId}
        profile={{
          name: profile.name,
          persona: profile.persona,
          model: profile.model,
          reminderEmail: profile.reminderEmail ?? "",
          remindersEnabled: profile.remindersEnabled,
          digestEnabled: profile.digestEnabled,
          digestHour: profile.digestHour,
          inactivityDays: profile.inactivityDays,
          autonomousProgramming: profile.autonomousProgramming,
          daysOfWeek: pc.daysOfWeek ?? [1, 3, 5],
          caps: pc.caps ?? {},
          excluded: pc.excluded ?? [],
        }}
        memories={memories.map((m) => ({
          id: m.id,
          kind: m.kind,
          content: m.content,
          pinned: m.pinned,
        }))}
        blackouts={blackouts.map((b) => ({
          id: b.id,
          startDate: b.startDate,
          endDate: b.endDate,
          reason: b.reason,
        }))}
      />
    </div>
  );
}
