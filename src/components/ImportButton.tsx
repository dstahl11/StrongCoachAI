"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileUp, Loader2, CheckCircle2 } from "lucide-react";
import Modal from "./Modal";

type Summary = {
  workouts: number;
  exercises: number;
  loggedSets: number;
  skippedRows: number;
};

export default function ImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("append");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setError(null);
    setResult(null);
    setBusy(false);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data.summary);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold text-ink hover:bg-canvas"
      >
        <Upload size={16} /> Import CSV
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Import workout history">
        {result ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={40} className="mx-auto text-good" />
            <p className="mt-3 font-semibold">Import complete</p>
            <div className="mt-3 inline-grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted">Workouts</span>
              <span className="text-right font-semibold">{result.workouts}</span>
              <span className="text-muted">Exercises</span>
              <span className="text-right font-semibold">{result.exercises}</span>
              <span className="text-muted">Logged sets</span>
              <span className="text-right font-semibold">{result.loggedSets}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted">
              Upload a Barbell Logic / TurnKey workout-history{" "}
              <code className="rounded bg-canvas px-1">.csv</code> export.
            </p>

            <button
              onClick={() => inputRef.current?.click()}
              className="mt-3 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line py-8 text-sm text-muted hover:border-brand-500 hover:text-brand-600"
            >
              <FileUp size={24} />
              {file ? (
                <span className="font-medium text-ink">{file.name}</span>
              ) : (
                "Choose a CSV file"
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />

            <div className="mt-4 space-y-2 text-sm">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "append"}
                  onChange={() => setMode("append")}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Add to existing</span>
                  <span className="block text-xs text-muted">
                    Keeps current data and appends these workouts.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Replace all workouts</span>
                  <span className="block text-xs text-muted">
                    Wipes existing workouts first (keeps the exercise catalog).
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </p>
            )}

            <button
              disabled={!file || busy}
              onClick={submit}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Importing…
                </>
              ) : (
                "Import"
              )}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
