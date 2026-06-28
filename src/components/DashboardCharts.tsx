"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { TonnagePoint, TrendPoint } from "@/lib/queries";

const PALETTE = [
  "#06b6d4",
  "#3b82f6",
  "#ec4899",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
];

const shortDate = (iso: string) => format(parseISO(iso + "T00:00:00"), "MMM d");

export function TonnageChart({
  points,
  exercises,
}: {
  points: TonnagePoint[];
  exercises: string[];
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const data = points.map((p) => ({ ...p, label: shortDate(p.date as string) }));
  return (
    <div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
            />
            {exercises.map((ex, i) => (
              <Bar
                key={ex}
                dataKey={ex}
                stackId="t"
                fill={PALETTE[i % PALETTE.length]}
                hide={hidden.has(ex)}
                radius={i === exercises.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend2 items={exercises} hidden={hidden} setHidden={setHidden} />
    </div>
  );
}

export function StrengthTrendChart({
  points,
  exercises,
}: {
  points: TrendPoint[];
  exercises: string[];
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const data = points.map((p) => ({ ...p, label: shortDate(p.date as string) }));
  return (
    <div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={["dataMin - 20", "dataMax + 20"]}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
              formatter={(v) => [`${Number(v)} lb e1RM`, ""]}
            />
            {exercises.map((ex, i) => (
              <Line
                key={ex}
                type="monotone"
                dataKey={ex}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
                hide={hidden.has(ex)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend2 items={exercises} hidden={hidden} setHidden={setHidden} />
    </div>
  );
}

function Legend2({
  items,
  hidden,
  setHidden,
}: {
  items: string[];
  hidden: Set<string>;
  setHidden: (s: Set<string>) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((ex, i) => (
        <button
          key={ex}
          onClick={() => {
            const next = new Set(hidden);
            if (next.has(ex)) next.delete(ex);
            else next.add(ex);
            setHidden(next);
          }}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            hidden.has(ex) ? "text-muted opacity-50" : "text-ink",
          )}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: PALETTE[i % PALETTE.length] }}
          />
          {ex}
        </button>
      ))}
    </div>
  );
}
