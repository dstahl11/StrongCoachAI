/**
 * Starts the coach's daily heartbeat (node-cron) inside the long-lived Node
 * server. Runs hourly and fires the digest/reminders at the configured hour.
 *
 * Enabled in production, or in dev when COACH_CRON=1. Testing is normally done
 * via the /coach/settings buttons or POST /api/coach/tick.
 */
let started = false;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (started) return;
  const enabled =
    process.env.NODE_ENV === "production" || process.env.COACH_CRON === "1";
  if (!enabled) return;
  started = true;

  const cron = (await import("node-cron")).default;
  const { runDailyTick } = await import("@/lib/coach/reminders");
  const { getCoachProfile } = await import("@/lib/coach/context");

  // top of every hour; the handler decides whether it's the configured hour
  cron.schedule("0 * * * *", async () => {
    try {
      const profile = await getCoachProfile();
      if (!profile.digestEnabled && !profile.remindersEnabled) return;
      if (new Date().getHours() !== profile.digestHour) return;
      const report = await runDailyTick();
      console.log("[coach] daily tick:", JSON.stringify(report));
    } catch (e) {
      console.error("[coach] tick error", e);
    }
  });

  console.log("[coach] scheduler started (hourly check)");
}
