"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import Modal from "./Modal";
import { cn } from "@/lib/utils";
import { fmt, fromISO, todayISO } from "@/lib/dates";
import { fmtWeight } from "@/lib/strength";
import type { HistoryEntry, ExercisePR } from "@/lib/queries";

const RANGES = [
  { key: "30d", label: "30d", days: 30 },
  { key: "3mo", label: "3mo", days: 90 },
  { key: "6mo", label: "6mo", days: 182 },
  { key: "1yr", label: "1yr", days: 365 },
  { key: "all", label: "All", days: Infinity },
] as const;

type Data = { name: string; history: HistoryEntry[]; prs: ExercisePR[] };

export default function StatsHistoryModal({
  exerciseId,
  open,
  onClose,
}: {
  exerciseId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3mo");
  const [series, setSeries] = useState({ recent: true, prs: true, e1rm: true });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/exercise/${exerciseId}/stats`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [open, exerciseId]);

  const cutoff = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    if (days === Infinity) return "0000-01-01";
    const t = fromISO(todayISO());
    t.setDate(t.getDate() - days);
    return t.toISOString().slice(0, 10);
  }, [range]);

  const chart = useMemo(() => {
    if (!data) return { rows: [], pr: 0, scheme: "" };
    const filtered = data.history
      .filter((h) => h.date >= cutoff)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const pr = Math.max(0, ...data.history.map((h) => h.e1rm));
    const last = data.history[0];
    const scheme = last ? `${last.sets} x ${last.reps} History` : "History";
    return {
      rows: filtered.map((h) => ({
        date: fmt.histDate(h.date),
        weight: h.weight,
        e1rm: h.e1rm,
      })),
      pr: Math.round(pr * 10) / 10,
      scheme,
    };
  }, [data, cutoff]);

  return (
    <Modal open={open} onClose={onClose} title={`${data?.name ?? ""} stats & history`}>
      {loading || !data ? (
        <div className="py-16 text-center text-sm text-muted">Loading…</div>
      ) : (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Stats
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2 text-xs">
              <Toggle
                color="#06b6d4"
                active={series.recent}
                onClick={() => setSeries((s) => ({ ...s, recent: !s.recent }))}
              >
                Recent
              </Toggle>
              <Toggle
                color="#f59e0b"
                active={series.prs}
                onClick={() => setSeries((s) => ({ ...s, prs: !s.prs }))}
              >
                PRs
              </Toggle>
              <Toggle
                color="#8b5cf6"
                active={series.e1rm}
                onClick={() => setSeries((s) => ({ ...s, e1rm: !s.e1rm }))}
              >
                e1RM
              </Toggle>
            </div>
            <div className="flex rounded-lg border border-line p-0.5 text-xs">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "rounded-md px-2 py-1 font-medium",
                    range === r.key
                      ? "bg-canvas text-ink"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 font-bold">{chart.scheme}</div>

          <div className="mt-2 h-64 w-full">
            {chart.rows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                No data in this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.rows} margin={{ top: 16, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="#eef0f3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    domain={["dataMin - 20", "dataMax + 20"]}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                    formatter={(v, n) => [
                      `${fmtWeight(Number(v))} lb`,
                      String(n) === "weight" ? "Working" : "e1RM",
                    ]}
                  />
                  {series.prs && chart.pr > 0 && (
                    <ReferenceLine
                      y={chart.pr}
                      stroke="#f59e0b"
                      strokeDasharray="6 4"
                      label={{
                        value: `PR: ${fmtWeight(chart.pr)}`,
                        position: "insideTopLeft",
                        fill: "#b45309",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  {series.e1rm && (
                    <Line
                      type="monotone"
                      dataKey="e1rm"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                    />
                  )}
                  {series.recent && (
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#06b6d4" }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* History list */}
          <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
            History
          </div>
          <div className="mt-2 divide-y divide-line">
            {data.history.map((h, i) => (
              <div key={i} className="py-3">
                <div className="text-sm font-semibold text-muted">
                  {fmt.histDate(h.date)}
                </div>
                <div className="mt-0.5">
                  {h.sets} × {h.reps} @ {fmtWeight(h.weight)} lb
                  <span className="ml-2 text-xs text-muted">
                    e1RM {fmtWeight(h.e1rm)}
                  </span>
                </div>
                {h.videoUrl && (
                  <a
                    href={h.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    View video
                  </a>
                )}
              </div>
            ))}
            {data.history.length === 0 && (
              <div className="py-6 text-sm text-muted">No history yet.</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Toggle({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition",
        active ? "border-line bg-canvas text-ink" : "border-line text-muted opacity-50",
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {children}
    </button>
  );
}
