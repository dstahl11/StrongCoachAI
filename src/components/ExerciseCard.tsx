"use client";

import { useMemo, useState, useTransition } from "react";
import {
  PlayCircle,
  LineChart,
  X,
  ChevronDown,
  Video,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtWeight, warmupSets } from "@/lib/strength";
import type { WorkoutExerciseView } from "@/lib/queries";
import {
  saveLoggedSets,
  setExerciseSkipped,
  saveExerciseComment,
  saveExerciseVideo,
} from "@/app/actions";
import StatsHistoryModal from "./StatsHistoryModal";

type Row = { reps: number; weight: number; completed: boolean };
type Group = {
  id: number;
  sets: number;
  reps: number;
  weight: number;
  rows: Row[];
};

function buildGroups(we: WorkoutExerciseView): Group[] {
  const logged = [...we.loggedSets].sort((a, b) => a.setNumber - b.setNumber);
  let cursor = 0;
  return we.setGroups
    .filter((g) => !g.isWarmup)
    .map((g) => {
      const rows: Row[] = [];
      for (let i = 0; i < g.sets; i++) {
        const l = logged[cursor];
        cursor++;
        rows.push(
          l
            ? { reps: l.reps, weight: l.weight, completed: l.completed }
            : { reps: g.reps, weight: g.weight, completed: false },
        );
      }
      return { id: g.id, sets: g.sets, reps: g.reps, weight: g.weight, rows };
    });
}

export default function ExerciseCard({
  we,
  date,
  letter,
}: {
  we: WorkoutExerciseView;
  date: string;
  letter: string;
}) {
  const [groups, setGroups] = useState<Group[]>(() => buildGroups(we));
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [showWarmup, setShowWarmup] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [skipped, setSkipped] = useState(we.skipped);
  const [comment, setComment] = useState(we.comment ?? "");
  const [commentEditing, setCommentEditing] = useState(false);
  const [videoEditing, setVideoEditing] = useState(false);
  const [video, setVideo] = useState(we.videoUrl ?? "");
  const [, startTransition] = useTransition();

  const totalDone = useMemo(
    () => groups.reduce((n, g) => n + g.rows.filter((r) => r.completed).length, 0),
    [groups],
  );
  const totalSets = useMemo(
    () => groups.reduce((n, g) => n + g.rows.length, 0),
    [groups],
  );

  function persist(next: Group[]) {
    setGroups(next);
    const flat = next.flatMap((g) =>
      g.rows.map((r) => ({ reps: r.reps, weight: r.weight, completed: r.completed })),
    );
    startTransition(() => saveLoggedSets(we.id, flat, date));
  }

  function updateRow(gi: number, ri: number, patch: Partial<Row>) {
    const next = groups.map((g, i) =>
      i === gi
        ? { ...g, rows: g.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) }
        : g,
    );
    persist(next);
  }

  function completeAll(gi: number) {
    const next = groups.map((g, i) =>
      i === gi ? { ...g, rows: g.rows.map((r) => ({ ...r, completed: true })) } : g,
    );
    persist(next);
  }

  const warmups = groups[0]
    ? warmupSets(groups[0].weight, groups[0].reps)
    : [];

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-card shadow-sm",
        skipped && "opacity-60",
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-brand-50 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
            {letter}
          </span>
          <span className="truncate font-bold">{we.exercise.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {we.exercise.demoUrl && (
            <a
              href={we.exercise.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 font-medium text-brand-600 hover:underline sm:flex"
            >
              <PlayCircle size={16} /> Demo
            </a>
          )}
          <button
            onClick={() => setStatsOpen(true)}
            className="flex items-center gap-1 font-medium text-brand-600 hover:underline"
          >
            <LineChart size={16} /> <span className="hidden sm:inline">Stats &amp; history</span>
          </button>
          <button
            onClick={() => {
              const next = !skipped;
              setSkipped(next);
              startTransition(() => setExerciseSkipped(we.id, next, date));
            }}
            className={cn(
              "flex items-center gap-1 font-medium",
              skipped ? "text-brand-600" : "text-muted hover:text-ink",
            )}
          >
            <X size={16} /> {skipped ? "Unskip" : "Skip"}
          </button>
        </div>
      </div>

      {!skipped && (
        <div className="px-3 py-3">
          {/* Warm-up sets */}
          {showWarmup && (
            <div className="mb-3 rounded-xl bg-canvas p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                Warm-up
              </div>
              <div className="space-y-1">
                {warmups.map((w, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted">{w.pct}%</span>
                    <span>
                      {w.reps} × {fmtWeight(w.weight)} lb
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prescription set-lines */}
          <div className="space-y-1">
            {groups.map((g, gi) => {
              const done = g.rows.filter((r) => r.completed).length;
              const isOpen = open[gi];
              return (
                <div key={g.id} className="rounded-xl border border-line">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [gi]: !o[gi] }))}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                  >
                    <span className="font-medium">
                      {g.sets} × {g.reps} @ {fmtWeight(g.weight)} lb
                    </span>
                    <span className="flex items-center gap-2">
                      {done > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            done === g.rows.length
                              ? "bg-good/10 text-good"
                              : "bg-brand-50 text-brand-600",
                          )}
                        >
                          {done}/{g.rows.length}
                        </span>
                      )}
                      <ChevronDown
                        size={18}
                        className={cn(
                          "text-muted transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-line px-3 py-2">
                      <div className="mb-1 grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 text-[11px] font-semibold uppercase text-muted">
                        <span>Set</span>
                        <span>Weight</span>
                        <span>Reps</span>
                        <span className="text-right">Done</span>
                      </div>
                      {g.rows.map((r, ri) => (
                        <div
                          key={ri}
                          className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 py-1"
                        >
                          <span className="text-sm text-muted">{ri + 1}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="2.5"
                            value={r.weight}
                            onChange={(e) =>
                              updateRow(gi, ri, {
                                weight: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums focus:border-brand-500 focus:outline-none"
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            value={r.reps}
                            onChange={(e) =>
                              updateRow(gi, ri, {
                                reps: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums focus:border-brand-500 focus:outline-none"
                          />
                          <button
                            onClick={() => updateRow(gi, ri, { completed: !r.completed })}
                            className={cn(
                              "ml-auto flex h-7 w-7 items-center justify-center rounded-full border transition",
                              r.completed
                                ? "border-good bg-good text-white"
                                : "border-line text-transparent hover:border-good",
                            )}
                            aria-label="Toggle set complete"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => completeAll(gi)}
                        className="mt-2 w-full rounded-lg border border-line py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
                      >
                        Mark all done
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action row */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              {video ? (
                <a
                  href={video}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                >
                  <Video size={16} /> View video
                </a>
              ) : (
                <button
                  onClick={() => setVideoEditing((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
                >
                  <Video size={16} /> Add video
                </button>
              )}
            </div>
            <button
              onClick={() => setShowWarmup((s) => !s)}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              {showWarmup ? "Hide warm up" : "Show warm up"}
            </button>
          </div>

          {videoEditing && (
            <div className="mt-2 flex gap-2">
              <input
                value={video}
                onChange={(e) => setVideo(e.target.value)}
                placeholder="Paste a video URL"
                className="flex-1 rounded-lg border border-line px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  setVideoEditing(false);
                  startTransition(() => saveExerciseVideo(we.id, video, date));
                }}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Save
              </button>
            </div>
          )}

          {/* Comment */}
          <div className="mt-3 border-t border-line pt-3">
            {commentEditing ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={`Add ${we.exercise.name} comment`}
                  className="flex-1 rounded-lg border border-line px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setCommentEditing(false);
                      startTransition(() => saveExerciseComment(we.id, comment, date));
                    }
                  }}
                />
                <button
                  onClick={() => {
                    setCommentEditing(false);
                    startTransition(() => saveExerciseComment(we.id, comment, date));
                  }}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCommentEditing(true)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted hover:text-ink"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas text-[10px] font-bold ring-1 ring-line">
                  DS
                </span>
                {comment || `Add ${we.exercise.name} comment`}
              </button>
            )}
          </div>
        </div>
      )}

      <StatsHistoryModal
        exerciseId={we.exercise.id}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
      />
    </div>
  );
}
