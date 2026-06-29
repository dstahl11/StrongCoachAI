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

  // hourly; runDailyTick fires each user at their own configured digest hour
  cron.schedule("0 * * * *", async () => {
    try {
      const report = await runDailyTick();
      if (report.users) console.log("[coach] daily tick:", JSON.stringify(report));
    } catch (e) {
      console.error("[coach] tick error", e);
    }
  });

  console.log("[coach] scheduler started (hourly check)");
}
