import { getCoachProfile } from "@/lib/coach/context";
import { getTranscript } from "@/lib/coach/chat";
import { coachConfigured } from "@/lib/coach/client";
import CoachChat from "@/components/CoachChat";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const [profile, transcript] = await Promise.all([
    getCoachProfile(),
    getTranscript(),
  ]);

  return (
    <CoachChat
      coachName={profile.name}
      configured={coachConfigured()}
      initialMessages={transcript.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }))}
    />
  );
}
