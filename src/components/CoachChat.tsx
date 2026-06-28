"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Send,
  Settings,
  Loader2,
  Dumbbell,
  Brain,
  SlidersHorizontal,
  Plane,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { sendCoachMessage, clearCoachChat } from "@/app/coach/actions";

type Msg = { id: number | string; role: "user" | "assistant"; content: string };

const ACTION_LABEL: Record<string, { icon: React.ReactNode; text: string }> = {
  schedule_workout: { icon: <Dumbbell size={12} />, text: "Updated your calendar" },
  program_upcoming: { icon: <Dumbbell size={12} />, text: "Programmed your upcoming days" },
  remember: { icon: <Brain size={12} />, text: "Saved to memory" },
  forget: { icon: <Brain size={12} />, text: "Updated memory" },
  update_program_config: { icon: <SlidersHorizontal size={12} />, text: "Adjusted your program" },
  set_blackout: { icon: <Plane size={12} />, text: "Blocked out those days" },
  clear_blackout: { icon: <Plane size={12} />, text: "Cleared a blackout" },
};

const SUGGESTIONS = [
  "What should I train today, and why?",
  "How's my squat progressing?",
  "Remember: my right shoulder is flaring up this week.",
  "Plan my next session.",
];

export default function CoachChat({
  coachName,
  configured,
  initialMessages,
}: {
  coachName: string;
  configured: boolean;
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const t = text.trim();
    if (!t || pending) return;
    setInput("");
    setActions([]);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: t }]);
    startTransition(async () => {
      const res = await sendCoachMessage(t);
      setActions(res.actions);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.reply || "(no response)",
        },
      ]);
    });
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-2xl flex-col px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            {coachName.slice(0, 1)}
          </div>
          <div>
            <div className="font-bold leading-tight">{coachName}</div>
            <div className="text-xs text-muted">Your strength coach</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (pending) return;
                startTransition(async () => {
                  await clearCoachChat();
                  setMessages([]);
                  setActions([]);
                });
              }}
              className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
              title="Clear chat"
            >
              <Trash2 size={18} />
            </button>
          )}
          <Link
            href="/coach/settings"
            className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
            title="Coach settings"
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {!configured && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The coach isn&apos;t connected yet. Add <code>PORTKEY_API_KEY</code> to{" "}
          <code>.env.local</code> and restart to start chatting.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto pb-2">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Dumbbell size={26} />
            </div>
            <p className="mt-3 font-semibold">Talk to {coachName}</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Ask about your programming, log how you feel, or tell {coachName}{" "}
              something to remember. He knows your training history.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!configured}
                  className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                m.role === "user"
                  ? "whitespace-pre-wrap bg-brand-600 text-white"
                  : "border border-line bg-card text-ink",
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose-coach space-y-2">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3.5 py-2.5 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> {coachName} is thinking…
            </div>
          </div>
        )}

        {actions.length > 0 && !pending && (
          <div className="flex flex-wrap justify-start gap-2">
            {[...new Set(actions)].map((a) =>
              ACTION_LABEL[a] ? (
                <span
                  key={a}
                  className="flex items-center gap-1 rounded-full bg-good/10 px-2.5 py-1 text-xs font-medium text-good"
                >
                  {ACTION_LABEL[a].icon} {ACTION_LABEL[a].text}
                </span>
              ) : null,
            )}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-line py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={configured ? `Message ${coachName}…` : "Coach not connected"}
            disabled={!configured || pending}
            className="max-h-40 flex-1 resize-none rounded-xl border border-line bg-card px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <button
            onClick={() => send(input)}
            disabled={!configured || pending || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
