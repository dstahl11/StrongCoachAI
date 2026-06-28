import "server-only";
import { and, asc, desc, eq, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  workouts,
  workoutExercises,
  setGroups,
  coachEvents,
  type CoachProfile,
} from "@/db/schema";
import { todayISO, fmt, shiftISO } from "@/lib/dates";
import { fmtWeight } from "@/lib/strength";
import { portkey, coachModel, coachConfigured } from "./client";
import { getCoachProfile, getMemories, memoriesToText } from "./context";
import { sendEmail, emailShell, emailConfigured } from "./email";
import { getBlackouts, blackoutFor } from "./blackouts";
import { ensureScheduled } from "./program";

const num = (v: string | number | null) =>
  v === null ? 0 : typeof v === "number" ? v : parseFloat(v);

export { getBlackouts };

// ---- event log / dedupe ----
async function alreadyDone(dedupeKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: coachEvents.id })
    .from(coachEvents)
    .where(eq(coachEvents.dedupeKey, dedupeKey))
    .limit(1);
  return rows.length > 0;
}
async function logEvent(e: {
  type: string;
  status: string;
  subject?: string;
  body?: string;
  dedupeKey?: string;
  meta?: unknown;
}) {
  await db.insert(coachEvents).values({
    type: e.type,
    channel: "email",
    status: e.status,
    subject: e.subject ?? null,
    body: e.body ?? null,
    dedupeKey: e.dedupeKey ?? null,
    meta: (e.meta as object) ?? null,
  });
}

// ---- workout line helper ----
async function planLines(workoutId: number): Promise<string[]> {
  const wes = await db.query.workoutExercises.findMany({
    where: eq(workoutExercises.workoutId, workoutId),
    orderBy: asc(workoutExercises.position),
    with: { exercise: true, setGroups: { orderBy: asc(setGroups.position) } },
  });
  return wes
    .filter((w) => !w.skipped)
    .map((w) => {
      const g = w.setGroups[0];
      return g
        ? `${w.exercise.name}: ${g.sets} × ${g.reps} @ ${fmtWeight(num(g.weight))} lb`
        : w.exercise.name;
    });
}

export type Miss = { date: string; lines: string[] };

/** Past planned workouts not completed (and not on a blackout day). */
export async function detectMisses(profile: CoachProfile): Promise<Miss[]> {
  const today = todayISO();
  const ranges = await getBlackouts();
  const rows = await db
    .select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .where(and(lt(workouts.date, today), ne(workouts.status, "complete")))
    .orderBy(desc(workouts.date))
    .limit(10);

  const out: Miss[] = [];
  for (const w of rows) {
    if (blackoutFor(w.date, ranges)) continue;
    out.push({ date: w.date, lines: await planLines(w.id) });
  }
  // keep within the grace window so we don't nag about ancient history
  const cutoff = shiftISO(today, -(profile.missedGraceDays + 14));
  return out.filter((m) => m.date >= cutoff);
}

// ---- LLM text (persona-flavored) with template fallback ----
async function personaWrite(
  task: string,
  facts: string,
  model: string,
): Promise<string | null> {
  if (!coachConfigured()) return null;
  try {
    const profile = await getCoachProfile();
    const memories = await getMemories();
    const sys = `${profile.persona || "You are an encouraging strength coach."}

You are ${profile.name}. Write a SHORT email body (2-4 sentences, warm, in your voice).
Plain text only — no subject line, no greeting headers, no markdown. Reference the facts given.
Remember about the athlete:
${memoriesToText(memories)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await portkey().chat.completions.create({
      model,
      max_tokens: 300,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `${task}\n\nFacts:\n${facts}` },
      ],
    });
    const text = res.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch {
    return null;
  }
}

// ---- digest ----
export async function composeDigest(profile: CoachProfile): Promise<{
  subject: string;
  html: string;
  kind: "workout" | "rest" | "away";
}> {
  const today = todayISO();
  const ranges = await getBlackouts();
  const away = blackoutFor(today, ranges);

  const todays = await db.query.workouts.findFirst({
    where: eq(workouts.date, today),
  });
  const lines = todays ? await planLines(todays.id) : [];

  let kind: "workout" | "rest" | "away" = "rest";
  let facts = "";
  if (away) {
    kind = "away";
    facts = `The athlete is away today (${away.reason ?? "out of town"}). It's a rest/travel day.`;
  } else if (todays && lines.length && todays.status !== "complete") {
    kind = "workout";
    facts = `Today's session:\n${lines.join("\n")}`;
  } else if (todays && todays.status === "complete") {
    kind = "rest";
    facts = "Today's workout is already done. Nice. Encourage recovery.";
  } else {
    kind = "rest";
    facts = "No workout is programmed for today — a rest day.";
  }

  const written = await personaWrite(
    "Write this morning's training digest email.",
    facts,
    coachModel(profile.model),
  );

  const planHtml =
    kind === "workout"
      ? `<div style="margin-top:12px;padding:12px;background:#eff5ff;border-radius:10px">
           <div style="font-weight:600;margin-bottom:6px">Today's session</div>
           ${lines.map((l) => `<div>• ${l}</div>`).join("")}
         </div>`
      : "";

  const intro =
    written ??
    (kind === "away"
      ? `You're away today (${away?.reason ?? "out of town"}). Rest up — we'll pick it back up when you're home.`
      : kind === "workout"
        ? `Good morning. Here's what's on deck today. Warm up well and hit your work sets.`
        : `Good morning. No session programmed today — recover, eat, and be ready for the next one.`);

  const subject =
    kind === "workout"
      ? `Today's training — ${fmt.dayShort(today)}`
      : kind === "away"
        ? `Rest day (away) — ${fmt.dayShort(today)}`
        : `Rest day — ${fmt.dayShort(today)}`;

  return {
    subject,
    kind,
    html: emailShell(subject, `<p style="margin:0">${escapeHtml(intro)}</p>${planHtml}`),
  };
}

export async function composeReminder(
  profile: CoachProfile,
  miss: Miss,
): Promise<{ subject: string; html: string }> {
  const facts = `Missed/incomplete session on ${fmt.dayShort(miss.date)}:\n${
    miss.lines.join("\n") || "(planned training)"
  }`;
  const written = await personaWrite(
    "Write a short accountability nudge about this missed session — firm but encouraging, and invite them to get it in or reschedule.",
    facts,
    coachModel(profile.model),
  );
  const intro =
    written ??
    `Looks like ${fmt.dayShort(miss.date)} got away from you. No guilt — just get the next one in. Want me to reschedule it?`;
  const planHtml = miss.lines.length
    ? `<div style="margin-top:12px;padding:12px;background:#fef2f2;border-radius:10px">
         ${miss.lines.map((l) => `<div>• ${l}</div>`).join("")}
       </div>`
    : "";
  const subject = `You missed ${fmt.dayShort(miss.date)} — let's get back on track`;
  return {
    subject,
    html: emailShell(subject, `<p style="margin:0">${escapeHtml(intro)}</p>${planHtml}`),
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

export type TickReport = {
  ranAt: string;
  digest: "sent" | "skipped" | "failed" | "disabled" | "no-email";
  reminders: { sent: number; skipped: number; failed: number };
  notes: string[];
};

/** The daily heartbeat: morning digest + miss reminders (+ Phase 3 autoscheduling). */
export async function runDailyTick(
  opts: { force?: boolean } = {},
): Promise<TickReport> {
  const profile = await getCoachProfile();
  const today = todayISO();
  const to = profile.reminderEmail || process.env.COACH_REMINDER_TO || "";
  const report: TickReport = {
    ranAt: new Date().toISOString(),
    digest: "skipped",
    reminders: { sent: 0, skipped: 0, failed: 0 },
    notes: [],
  };

  if (!emailConfigured()) report.notes.push("Email not configured (RESEND_API_KEY).");
  if (!to) report.notes.push("No reminder email set.");

  // ----- autonomous programming: keep the calendar populated -----
  if (profile.autonomousProgramming) {
    try {
      const created = await ensureScheduled(profile, 14);
      if (created.length) {
        report.notes.push(`Programmed ${created.length} upcoming session(s).`);
        await logEvent({
          type: "program_update",
          status: "sent",
          subject: "auto-scheduled sessions",
          meta: { created: created.map((c) => c.date) },
        });
      }
    } catch (e) {
      report.notes.push(
        `Auto-scheduling failed: ${e instanceof Error ? e.message : "error"}`,
      );
    }
  }

  // ----- digest -----
  if (!profile.digestEnabled && !opts.force) {
    report.digest = "disabled";
  } else if (!to || !emailConfigured()) {
    report.digest = "no-email";
  } else {
    const dedupe = `digest:${today}`;
    if (!opts.force && (await alreadyDone(dedupe))) {
      report.digest = "skipped";
    } else {
      const d = await composeDigest(profile);
      const r = await sendEmail({ to, subject: d.subject, html: d.html });
      await logEvent({
        type: "digest",
        status: r.ok ? "sent" : "failed",
        subject: d.subject,
        dedupeKey: opts.force ? `digest:${today}:force:${Date.now()}` : dedupe,
        meta: { kind: d.kind, error: r.error },
      });
      report.digest = r.ok ? "sent" : "failed";
      if (!r.ok) report.notes.push(`Digest failed: ${r.error}`);
    }
  }

  // ----- miss reminders -----
  if ((profile.remindersEnabled || opts.force) && to && emailConfigured()) {
    const misses = await detectMisses(profile);
    for (const m of misses) {
      const dedupe = `miss:${m.date}`;
      if (!opts.force && (await alreadyDone(dedupe))) {
        report.reminders.skipped++;
        continue;
      }
      const c = await composeReminder(profile, m);
      const r = await sendEmail({ to, subject: c.subject, html: c.html });
      await logEvent({
        type: "reminder",
        status: r.ok ? "sent" : "failed",
        subject: c.subject,
        dedupeKey: opts.force ? `miss:${m.date}:force:${Date.now()}` : dedupe,
        meta: { date: m.date, error: r.error },
      });
      if (r.ok) report.reminders.sent++;
      else report.reminders.failed++;
    }
  } else if (!opts.force && !profile.remindersEnabled) {
    report.notes.push("Miss reminders disabled.");
  }

  await logEvent({
    type: "check",
    status: "sent",
    subject: "daily tick",
    meta: { ...report },
  });
  return report;
}

/** Send a one-off test email of the given kind (ignores enabled flags + dedupe). */
export async function sendTest(kind: "digest" | "reminder"): Promise<{
  ok: boolean;
  error?: string;
}> {
  const profile = await getCoachProfile();
  const to = profile.reminderEmail || process.env.COACH_REMINDER_TO || "";
  if (!to) return { ok: false, error: "Set a reminder email first." };
  if (!emailConfigured())
    return { ok: false, error: "Email not configured (RESEND_API_KEY)." };

  if (kind === "digest") {
    const d = await composeDigest(profile);
    const r = await sendEmail({ to, subject: `[Test] ${d.subject}`, html: d.html });
    await logEvent({ type: "digest", status: r.ok ? "sent" : "failed", subject: `[Test] ${d.subject}`, meta: { test: true, error: r.error } });
    return r;
  }
  // reminder: use the most recent real miss, else a sample
  const misses = await detectMisses(profile);
  const miss: Miss = misses[0] ?? {
    date: shiftISO(todayISO(), -1),
    lines: ["Squat: 3 × 5 @ 170 lb", "Deadlift: 1 × 5 @ 185 lb"],
  };
  const c = await composeReminder(profile, miss);
  const r = await sendEmail({ to, subject: `[Test] ${c.subject}`, html: c.html });
  await logEvent({ type: "reminder", status: r.ok ? "sent" : "failed", subject: `[Test] ${c.subject}`, meta: { test: true, error: r.error } });
  return r;
}
