"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Send,
  Plus,
  ChevronDown,
  Trophy,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/dates";
import { fmtWeight } from "@/lib/strength";
import type { WorkoutView } from "@/lib/queries";
import {
  markWorkoutComplete,
  reopenWorkout,
  saveWorkoutComment,
  createWorkout,
  addExerciseToWorkout,
} from "@/app/actions";
import ExerciseCard from "./ExerciseCard";

const LETTERS = "ABCDEFGHIJ".split("");

type Summary = {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  e1rm: number;
};

export default function WorkoutDay({
  date,
  prev,
  next,
  workout,
  summary,
  exercises,
}: {
  date: string;
  prev: string;
  next: string;
  workout: WorkoutView | null;
  summary: Summary[];
  exercises: { id: number; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(workout?.notes ?? "");
  const [notesEditing, setNotesEditing] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPRs, setShowPRs] = useState(true);
  const [show1RM, setShow1RM] = useState(false);
  const [adding, setAdding] = useState(false);

  const complete = workout?.status === "complete";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6">
        {/* Date nav */}
        <div className="mb-4 flex items-center gap-2">
          <Link
            href={`/day/${prev}`}
            className="rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink"
            aria-label="Previous day"
          >
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">{fmt.dayShort(date)}</h1>
          <Link
            href={`/day/${next}`}
            className="rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink"
            aria-label="Next day"
          >
            <ChevronRight size={20} />
          </Link>
          <span className="ml-auto flex items-center gap-2">
            {workout?.source === "coach" && (
              <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600">
                <MessageCircle size={12} /> Coach
              </span>
            )}
            {complete && (
              <span className="flex items-center gap-1 text-sm font-medium text-good">
                <CheckCircle2 size={16} /> Completed
              </span>
            )}
          </span>
        </div>

        {workout && workout.exercises.length > 0 ? (
          <>
            <div className="space-y-3">
              {workout.exercises.map((we, i) => (
                <ExerciseCard
                  key={we.id}
                  we={we}
                  date={date}
                  letter={LETTERS[i]}
                />
              ))}
            </div>

            {/* Add exercise */}
            <AddExercise
              adding={adding}
              setAdding={setAdding}
              exercises={exercises}
              onAdd={(exerciseId, scheme) => {
                startTransition(async () => {
                  const wid = workout.id;
                  await addExerciseToWorkout(wid, exerciseId, scheme, date);
                  setAdding(false);
                });
              }}
            />

            {/* Complete / Send */}
            <div className="mt-4 flex gap-2">
              {complete ? (
                <button
                  onClick={() =>
                    startTransition(() => reopenWorkout(workout.id, date))
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-card py-3 font-semibold text-ink hover:bg-canvas"
                >
                  <CheckCircle2 size={18} className="text-good" /> Completed —
                  reopen
                </button>
              ) : (
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(() =>
                      markWorkoutComplete(workout.id, date),
                    )
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <CheckCircle2 size={18} /> Mark Complete
                </button>
              )}
              <button
                onClick={() => {
                  setSent(true);
                  setTimeout(() => setSent(false), 2000);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold",
                  sent
                    ? "bg-good text-white"
                    : "bg-brand-700 text-white hover:bg-brand-600",
                )}
              >
                <Send size={16} /> {sent ? "Sent" : "Send"}
              </button>
            </div>

            {/* Workout comment */}
            <div className="mt-3">
              {notesEditing ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add comment"
                    className="flex-1 rounded-lg border border-line px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setNotesEditing(false);
                        startTransition(() =>
                          saveWorkoutComment(workout.id, notes, date),
                        );
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      setNotesEditing(false);
                      startTransition(() =>
                        saveWorkoutComment(workout.id, notes, date),
                      );
                    }}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setNotesEditing(true)}
                  className="flex items-center gap-2 text-sm text-muted hover:text-ink"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas text-[10px] font-bold ring-1 ring-line">
                    DS
                  </span>
                  {notes || "Add comment"}
                </button>
              )}
            </div>

            {/* PRs + Estimated 1RMs */}
            {complete && summary.length > 0 && (
              <div className="mt-5 space-y-3">
                <Panel
                  icon={<Trophy size={16} className="text-amber-500" />}
                  title="PRs"
                  open={showPRs}
                  onToggle={() => setShowPRs((s) => !s)}
                >
                  <div className="space-y-2">
                    {summary.map((s) => (
                      <div key={s.name}>
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-sm text-muted">
                          {s.sets} x {s.reps}: {fmtWeight(s.weight)} lbs
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel
                  icon={<TrendingUp size={16} className="text-brand-600" />}
                  title="Estimated 1RMs"
                  open={show1RM}
                  onToggle={() => setShow1RM((s) => !s)}
                >
                  <div className="space-y-2">
                    {summary.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{s.name}</span>
                        <span className="font-semibold tabular-nums">
                          {fmtWeight(s.e1rm)} lbs
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}
          </>
        ) : (
          <EmptyDay
            date={date}
            exercises={exercises}
            onCreate={() =>
              startTransition(async () => {
                await createWorkout(date);
              })
            }
          />
        )}
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 font-semibold"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={18}
          className={cn("text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t border-line px-4 py-3">{children}</div>}
    </div>
  );
}

function EmptyDay({
  exercises,
  onCreate,
}: {
  date: string;
  exercises: { id: number; name: string }[];
  onCreate: () => void;
}) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted">No workout planned for this day.</p>
      <button
        onClick={onCreate}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <Plus size={16} /> Create workout
      </button>
      {exercises.length === 0 && (
        <p className="mt-3 text-xs text-muted">
          Tip: add movements in the Exercises tab first.
        </p>
      )}
    </div>
  );
}

function AddExercise({
  adding,
  setAdding,
  exercises,
  onAdd,
}: {
  adding: boolean;
  setAdding: (v: boolean) => void;
  exercises: { id: number; name: string }[];
  onAdd: (
    exerciseId: number,
    scheme: { sets: number; reps: number; weight: number },
  ) => void;
}) {
  const [exerciseId, setExerciseId] = useState<number | "">("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(5);
  const [weight, setWeight] = useState(135);

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-medium text-muted hover:border-brand-500 hover:text-brand-600"
      >
        <Plus size={16} /> Add exercise
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-line p-3">
      <select
        value={exerciseId}
        onChange={(e) => setExerciseId(Number(e.target.value))}
        className="mb-2 w-full rounded-lg border border-line px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
      >
        <option value="">Select an exercise…</option>
        {exercises.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Sets" value={sets} onChange={setSets} />
        <Field label="Reps" value={reps} onChange={setReps} />
        <Field label="Weight" value={weight} onChange={setWeight} step={2.5} />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          disabled={!exerciseId}
          onClick={() =>
            exerciseId && onAdd(Number(exerciseId), { sets, reps, weight })
          }
          className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={() => setAdding(false)}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}
