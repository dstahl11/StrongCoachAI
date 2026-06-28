"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  LineChart,
  Plus,
  Dumbbell,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { createExercise, updateExercise, deleteExercise } from "@/app/actions";
import StatsHistoryModal from "./StatsHistoryModal";

type Ex = {
  id: number;
  name: string;
  demoUrl: string | null;
  muscleGroup: string | null;
};

const empty = { name: "", muscleGroup: "", demoUrl: "" };

export default function ExerciseLibrary({ exercises }: { exercises: Ex[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [statsId, setStatsId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  // editId: number for editing existing, "new" for the create form, null for none
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    usedIn?: number;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.muscleGroup ?? "").toLowerCase().includes(q),
    );
  }, [exercises, query]);

  function openCreate() {
    setForm(empty);
    setEditId("new");
  }
  function openEdit(ex: Ex) {
    setForm({
      name: ex.name,
      muscleGroup: ex.muscleGroup ?? "",
      demoUrl: ex.demoUrl ?? "",
    });
    setEditId(ex.id);
  }

  function save() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      if (editId === "new") {
        await createExercise(form);
      } else if (typeof editId === "number") {
        await updateExercise(editId, form);
      }
      setEditId(null);
      setForm(empty);
      router.refresh();
    });
  }

  function doDelete(id: number, force: boolean) {
    startTransition(async () => {
      const res = await deleteExercise(id, force);
      if (!res.ok) {
        setConfirmDelete({ id, usedIn: res.usedIn });
      } else {
        setConfirmDelete(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Exercises</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} /> New exercise
        </button>
      </div>

      <div className="relative mb-4">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${exercises.length} exercises…`}
          className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      {editId === "new" && (
        <ExerciseForm
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={() => setEditId(null)}
        />
      )}

      <div className="space-y-2">
        {filtered.map((ex) =>
          editId === ex.id ? (
            <ExerciseForm
              key={ex.id}
              form={form}
              setForm={setForm}
              onSave={save}
              onCancel={() => setEditId(null)}
            />
          ) : (
            <div
              key={ex.id}
              className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Dumbbell size={18} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{ex.name}</div>
                  {ex.muscleGroup && (
                    <div className="text-xs text-muted">{ex.muscleGroup}</div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-sm">
                {ex.demoUrl && (
                  <a
                    href={ex.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden items-center gap-1 px-2 font-medium text-brand-600 hover:underline sm:flex"
                  >
                    <PlayCircle size={16} /> Demo
                  </a>
                )}
                <button
                  onClick={() => setStatsId(ex.id)}
                  className="flex items-center gap-1 px-2 font-medium text-brand-600 hover:underline"
                >
                  <LineChart size={16} />{" "}
                  <span className="hidden sm:inline">Stats</span>
                </button>
                <button
                  onClick={() => openEdit(ex)}
                  className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
                  aria-label="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => doDelete(ex.id, false)}
                  className="rounded-lg p-2 text-muted hover:bg-bad/10 hover:text-bad"
                  aria-label="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ),
        )}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-card py-12 text-center text-sm text-muted">
            No exercises match “{query}”.
          </div>
        )}
      </div>

      {/* Used-in delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">Delete exercise?</h3>
            <p className="mt-2 text-sm text-muted">
              This exercise is used in{" "}
              <span className="font-semibold text-ink">
                {confirmDelete.usedIn}
              </span>{" "}
              workout{confirmDelete.usedIn === 1 ? "" : "s"}. Deleting it will
              also remove that workout history.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => doDelete(confirmDelete.id, true)}
                className="rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Delete anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {statsId !== null && (
        <StatsHistoryModal
          exerciseId={statsId}
          open={statsId !== null}
          onClose={() => setStatsId(null)}
        />
      )}
    </div>
  );
}

function ExerciseForm({
  form,
  setForm,
  onSave,
  onCancel,
}: {
  form: typeof empty;
  setForm: (f: typeof empty) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mb-2 rounded-2xl border border-brand-500 bg-card p-4 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name (e.g. Front Squat)"
          className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          value={form.muscleGroup}
          onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })}
          placeholder="Muscle group (e.g. Legs)"
          className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <input
        value={form.demoUrl}
        onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
        placeholder="Demo video URL (optional)"
        className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={onSave}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
