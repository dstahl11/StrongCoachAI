import { NextResponse } from "next/server";
import { runDailyTick } from "@/lib/coach/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Daily coach heartbeat. Triggered by node-cron (instrumentation) or an
 *  external cron. Protected by CRON_SECRET when that env var is set. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const headerSecret = req.headers.get("x-cron-secret");
    const ok = auth === `Bearer ${secret}` || headerSecret === secret;
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  try {
    const report = await runDailyTick({ force });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "tick failed" },
      { status: 500 },
    );
  }
}
