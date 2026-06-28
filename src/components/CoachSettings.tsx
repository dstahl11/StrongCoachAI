"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Check,
  Mail,
  Loader2,
  Play,
  CalendarCog,
  Plane,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateCoachProfile,
  addCoachMemory,
  updateCoachMemory,
  deleteCoachMemory,
  sendTestEmail,
  runCoachTick,
  addBlackout,
  deleteBlackout,
  programUpcoming,
  updateProgramConfig,
} from "@/app/coach/actions";

type Mem = { id: number; kind: string; content: string; pinned: boolean };
type Blackout = {
  id: number;
  startDate: string;
  endDate: string;
  reason: string | null;
};

type ProfileProps = {
  name: string;
  persona: string;
  model: string;
  reminderEmail: string;
  remindersEnabled: boolean;
  digestEnabled: boolean;
  digestHour: number;
  inactivityDays: number;
  autonomousProgramming: boolean;
  daysOfWeek: number[];
  caps: Record<string, number>;
  excluded: string[];
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KINDS = ["injury", "constraint", "preference", "goal", "note"];
const KIND_COLOR: Record<string, string> = {
  injury: "bg-bad/10 text-bad",
  constraint: "bg-amber-100 text-amber-700",
  preference: "bg-brand-50 text-brand-600",
  goal: "bg-good/10 text-good",
  note: "bg-canvas text-muted",
};

export default function CoachSettings({
  profile,
  memories,
  blackouts,
}: {
  profile: ProfileProps;
  memories: Mem[];
  blackouts: Blackout[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // programming & schedule
  const [autonomous, setAutonomous] = useState(profile.autonomousProgramming);
  const [days, setDays] = useState<number[]>(profile.daysOfWeek);
  const [progSaved, setProgSaved] = useState<string | null>(null);
  const [progBusy, setProgBusy] = useState(false);
  const [progToast, setProgToast] = useState<string | null>(null);
  const [boStart, setBoStart] = useState("");
  const [boEnd, setBoEnd] = useState("");
  const [boReason, setBoReason] = useState("");

  function toggleDay(d: number) {
    setDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort(),
    );
  }
  function saveProgram() {
    startTransition(async () => {
      await updateCoachProfile({ autonomousProgramming: autonomous });
      await updateProgramConfig({ daysOfWeek: days });
      setProgSaved("Saved");
      setTimeout(() => setProgSaved(null), 1500);
      router.refresh();
    });
  }
  async function fillUpcoming() {
    setProgBusy(true);
    const r = await programUpcoming();
    setProgBusy(false);
    setProgToast(
      r.created ? `Programmed ${r.created} upcoming session(s) ✓` : "Nothing to add — already planned/blacked out.",
    );
    setTimeout(() => setProgToast(null), 4000);
    router.refresh();
  }

  const [name, setName] = useState(profile.name);
  const [persona, setPersona] = useState(profile.persona);
  const [model, setModel] = useState(profile.model);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // email / accountability
  const [email, setEmail] = useState(profile.reminderEmail);
  const [remindersEnabled, setRemindersEnabled] = useState(profile.remindersEnabled);
  const [digestEnabled, setDigestEnabled] = useState(profile.digestEnabled);
  const [digestHour, setDigestHour] = useState(profile.digestHour);
  const [inactivityDays, setInactivityDays] = useState(profile.inactivityDays);
  const [emailSaved, setEmailSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function saveEmail() {
    startTransition(async () => {
      await updateCoachProfile({
        reminderEmail: email || null,
        remindersEnabled,
        digestEnabled,
        digestHour,
        inactivityDays,
      });
      setEmailSaved("Saved");
      setTimeout(() => setEmailSaved(null), 1500);
      router.refresh();
    });
  }

  async function doTest(kind: "digest" | "reminder") {
    setBusy(kind);
    setToast(null);
    const res = await sendTestEmail(kind);
    setBusy(null);
    setToast(res.ok ? `Test ${kind} sent ✓` : `Failed: ${res.error}`);
    setTimeout(() => setToast(null), 4000);
  }

  async function doTick() {
    setBusy("tick");
    setToast(null);
    const r = await runCoachTick();
    setBusy(null);
    setToast(
      `Check ran — digest: ${r.digest}, reminders sent: ${r.reminders.sent}` +
        (r.notes.length ? ` (${r.notes.join("; ")})` : ""),
    );
    setTimeout(() => setToast(null), 6000);
    router.refresh();
  }

  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState("note");
  const [newContent, setNewContent] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editKind, setEditKind] = useState("note");
  const [editContent, setEditContent] = useState("");

  function saveProfile() {
    startTransition(async () => {
      await updateCoachProfile({ name, persona, model });
      setSavedAt("Saved");
      setTimeout(() => setSavedAt(null), 1500);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/coach"
          className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold">Coach settings</h1>
      </div>

      {/* Identity / Soul */}
      <section className="mb-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h2 className="font-bold">Identity &amp; personality</h2>
        <p className="mt-1 text-sm text-muted">
          This is your coach&apos;s &ldquo;soul&rdquo; — name, voice, and coaching
          philosophy. It&apos;s sent with every message.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium">
            Model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (balanced)</option>
              <option value="claude-opus-4-8">Claude Opus 4.8 (richest)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fast)</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium">
          Persona / soul
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={10}
            className="mt-1 w-full resize-y rounded-lg border border-line px-3 py-2 font-mono text-xs leading-relaxed focus:border-brand-500 focus:outline-none"
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={saveProfile}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
          {savedAt && (
            <span className="flex items-center gap-1 text-sm text-good">
              <Check size={16} /> {savedAt}
            </span>
          )}
        </div>
      </section>

      {/* Email accountability */}
      <section className="mb-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold">
          <Mail size={18} className="text-brand-600" /> Email accountability
        </h2>
        <p className="mt-1 text-sm text-muted">
          A morning digest of the day&apos;s plan, plus nudges when you miss a session.
        </p>

        <label className="mt-3 block text-sm font-medium">
          Send to
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>

        <div className="mt-3 space-y-2">
          <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
            <span className="text-sm">
              <span className="font-medium">Morning digest</span>
              <span className="block text-xs text-muted">Today&apos;s programming, every morning.</span>
            </span>
            <input
              type="checkbox"
              checked={digestEnabled}
              onChange={(e) => setDigestEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
            <span className="text-sm">
              <span className="font-medium">Missed-workout reminders</span>
              <span className="block text-xs text-muted">A nudge when a planned session slips.</span>
            </span>
            <input
              type="checkbox"
              checked={remindersEnabled}
              onChange={(e) => setRemindersEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Digest hour (0–23)
            <input
              type="number"
              min={0}
              max={23}
              value={digestHour}
              onChange={(e) => setDigestHour(parseInt(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium">
            Nudge after N quiet days
            <input
              type="number"
              min={1}
              value={inactivityDays}
              onChange={(e) => setInactivityDays(parseInt(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={saveEmail}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
          {emailSaved && (
            <span className="flex items-center gap-1 text-sm text-good">
              <Check size={16} /> {emailSaved}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => doTest("digest")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-50"
            >
              {busy === "digest" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Test digest
            </button>
            <button
              onClick={() => doTest("reminder")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-50"
            >
              {busy === "reminder" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Test reminder
            </button>
            <button
              onClick={doTick}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-50"
            >
              {busy === "tick" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run check now
            </button>
          </div>
        </div>
        {toast && (
          <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{toast}</p>
        )}
      </section>

      {/* Programming & schedule */}
      <section className="mb-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold">
          <CalendarCog size={18} className="text-brand-600" /> Programming &amp; schedule
        </h2>
        <p className="mt-1 text-sm text-muted">
          Let the coach keep your calendar filled with Starting Strength sessions, and tell
          it which days you train.
        </p>

        <label className="mt-3 flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
          <span className="text-sm">
            <span className="font-medium">Autonomous programming</span>
            <span className="block text-xs text-muted">
              Auto-fill upcoming training days (respects caps, exclusions, and travel).
            </span>
          </span>
          <input
            type="checkbox"
            checked={autonomous}
            onChange={(e) => setAutonomous(e.target.checked)}
            className="h-4 w-4"
          />
        </label>

        <div className="mt-3">
          <div className="mb-1.5 text-sm font-medium">Training days</div>
          <div className="flex flex-wrap gap-1.5">
            {DOW.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium",
                  days.includes(i)
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {(Object.keys(profile.caps).length > 0 || profile.excluded.length > 0) && (
          <div className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
            {Object.keys(profile.caps).length > 0 && (
              <div>
                <span className="font-medium text-ink">Caps:</span>{" "}
                {Object.entries(profile.caps)
                  .map(([k, v]) => `${k} ≤ ${v} lb`)
                  .join(", ")}
              </div>
            )}
            {profile.excluded.length > 0 && (
              <div>
                <span className="font-medium text-ink">Excluded:</span>{" "}
                {profile.excluded.join(", ")}
              </div>
            )}
            <div className="mt-0.5 italic">
              Ask {profile.name} in chat to change caps or excluded lifts.
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={saveProgram}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
          {progSaved && (
            <span className="flex items-center gap-1 text-sm text-good">
              <Check size={16} /> {progSaved}
            </span>
          )}
          <button
            onClick={fillUpcoming}
            disabled={progBusy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-50"
          >
            {progBusy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Program my upcoming days
          </button>
        </div>
        {progToast && (
          <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{progToast}</p>
        )}

        {/* Blackout days */}
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plane size={15} className="text-amber-600" /> Blackout days (travel)
          </div>
          <p className="mt-1 text-xs text-muted">
            The coach won&apos;t program or nag on these days.
          </p>

          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-muted">
              From
              <input
                type="date"
                value={boStart}
                onChange={(e) => setBoStart(e.target.value)}
                className="mt-1 block rounded-lg border border-line px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              To
              <input
                type="date"
                value={boEnd}
                onChange={(e) => setBoEnd(e.target.value)}
                className="mt-1 block rounded-lg border border-line px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <input
              value={boReason}
              onChange={(e) => setBoReason(e.target.value)}
              placeholder="Reason (e.g. Chicago trip)"
              className="min-w-[8rem] flex-1 rounded-lg border border-line px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button
              onClick={() =>
                startTransition(async () => {
                  await addBlackout(boStart, boEnd || boStart, boReason);
                  setBoStart("");
                  setBoEnd("");
                  setBoReason("");
                  router.refresh();
                })
              }
              disabled={!boStart}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {blackouts.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {b.startDate}
                    {b.endDate !== b.startDate ? ` → ${b.endDate}` : ""}
                  </span>
                  {b.reason && <span className="text-muted"> · {b.reason}</span>}
                </span>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      await deleteBlackout(b.id);
                      router.refresh();
                    })
                  }
                  className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad"
                  aria-label="Remove blackout"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {blackouts.length === 0 && (
              <p className="py-2 text-xs text-muted">No blackout days.</p>
            )}
          </div>
        </div>
      </section>

      {/* Memory */}
      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Memory</h2>
            <p className="mt-1 text-sm text-muted">
              Facts the coach remembers about you. These shape every answer and your
              programming.
            </p>
          </div>
          <button
            onClick={() => setAdding((a) => !a)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {adding && (
          <div className="mt-3 rounded-xl border border-brand-500 p-3">
            <div className="flex gap-2">
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
                className="rounded-lg border border-line px-2 py-2 text-sm capitalize focus:border-brand-500 focus:outline-none"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                autoFocus
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="e.g. Right knee aches on deep squats below 200"
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() =>
                  startTransition(async () => {
                    await addCoachMemory(newKind, newContent);
                    setNewContent("");
                    setAdding(false);
                    router.refresh();
                  })
                }
                className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white"
              >
                Save
              </button>
              <button
                onClick={() => setAdding(false)}
                className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {memories.map((m) =>
            editId === m.id ? (
              <div key={m.id} className="rounded-xl border border-brand-500 p-3">
                <div className="flex gap-2">
                  <select
                    value={editKind}
                    onChange={(e) => setEditKind(e.target.value)}
                    className="rounded-lg border border-line px-2 py-2 text-sm capitalize focus:border-brand-500 focus:outline-none"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await updateCoachMemory(m.id, {
                          kind: editKind,
                          content: editContent,
                          pinned: m.pinned,
                        });
                        setEditId(null);
                        router.refresh();
                      })
                    }
                    className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
              >
                <div className="min-w-0">
                  <span
                    className={cn(
                      "mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                      KIND_COLOR[m.kind] ?? KIND_COLOR.note,
                    )}
                  >
                    {m.kind}
                  </span>
                  <p className="text-sm">{m.content}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      setEditId(m.id);
                      setEditKind(m.kind);
                      setEditContent(m.content);
                    }}
                    className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink"
                    aria-label="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await deleteCoachMemory(m.id);
                        router.refresh();
                      })
                    }
                    className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad"
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ),
          )}
          {memories.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">
              No memories yet. Add facts about your training, injuries, or goals.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
