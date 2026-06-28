import { getCoachProfile, getMemories } from "@/lib/coach/context";
import { getBlackouts } from "@/lib/coach/blackouts";
import CoachSettings from "@/components/CoachSettings";

export const dynamic = "force-dynamic";

type ProgramConfig = {
  daysOfWeek?: number[];
  caps?: Record<string, number>;
  excluded?: string[];
};

export default async function CoachSettingsPage() {
  const [profile, memories, blackouts] = await Promise.all([
    getCoachProfile(),
    getMemories(),
    getBlackouts(),
  ]);
  const pc = (profile.programConfig as ProgramConfig) ?? {};

  return (
    <CoachSettings
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
  );
}
