"use client";

import { useMemo } from "react";
import { format, parseISO, startOfWeek, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { ConsistencyDay } from "@/lib/queries";

/**
 * GitHub-style heatmap: columns are weeks, rows are weekdays (Mon-Sun).
 * Month labels sit above the first column of each month.
 */
export default function ConsistencyHeatmap({
  days,
  since,
}: {
  days: ConsistencyDay[];
  since: string;
}) {
  const { weeks, monthLabels } = useMemo(() => {
    const map = new Map(days.map((d) => [d.date, d.status]));
    const start = startOfWeek(parseISO(since + "T00:00:00"), { weekStartsOn: 1 });
    const end = new Date();
    const weeks: { date: string; status: string }[][] = [];
    let cursor = start;
    while (cursor <= addDays(end, 6)) {
      const col: { date: string; status: string }[] = [];
      for (let i = 0; i < 7; i++) {
        const iso = format(cursor, "yyyy-MM-dd");
        col.push({ date: iso, status: map.get(iso) ?? "none" });
        cursor = addDays(cursor, 1);
      }
      weeks.push(col);
    }
    const monthLabels = weeks.map((col, i) => {
      const first = parseISO(col[0].date + "T00:00:00");
      const prev = i > 0 ? parseISO(weeks[i - 1][0].date + "T00:00:00") : null;
      if (!prev || first.getMonth() !== prev.getMonth()) {
        return format(first, "MMM").toUpperCase();
      }
      return "";
    });
    return { weeks, monthLabels };
  }, [days, since]);

  const color = (s: string) =>
    s === "done"
      ? "bg-good"
      : s === "missed"
        ? "bg-bad"
        : "bg-line";

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-1 pl-0">
          {weeks.map((_, i) => (
            <div key={i} className="w-3 text-[9px] font-semibold text-muted">
              {monthLabels[i]}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {weeks.map((col, i) => (
            <div key={i} className="flex flex-col gap-1">
              {col.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.status}`}
                  className={cn("h-3 w-3 rounded-sm", color(cell.status))}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
