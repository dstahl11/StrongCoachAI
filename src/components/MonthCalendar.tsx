"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  addDays,
} from "date-fns";
import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkoutDateStatus } from "@/lib/queries";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthId(d: Date) {
  return `m-${format(d, "yyyy-MM")}`;
}

type Blackout = { startDate: string; endDate: string; reason: string | null };

export default function MonthCalendar({
  statuses,
  blackouts = [],
  today,
}: {
  statuses: WorkoutDateStatus[];
  blackouts?: Blackout[];
  today: string;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const statusByDate = useMemo(
    () => new Map(statuses.map((s) => [s.date, s.status])),
    [statuses],
  );
  const blackoutFor = useMemo(
    () => (iso: string) =>
      blackouts.find((b) => iso >= b.startDate && iso <= b.endDate) ?? null,
    [blackouts],
  );

  const todayDate = parseISO(today + "T00:00:00");

  const months = useMemo(() => {
    const first = statuses.length
      ? parseISO(statuses[0].date + "T00:00:00")
      : todayDate;
    const last = addMonths(todayDate, 2);
    return eachMonthOfInterval({
      start: startOfMonth(first < todayDate ? first : todayDate),
      end: startOfMonth(last),
    });
  }, [statuses, today]);

  // Jump to current month on mount (newest data is near "today").
  useEffect(() => {
    const el = document.getElementById(monthId(todayDate));
    if (el && scrollRef.current) {
      scrollRef.current.scrollTop = el.offsetTop - scrollRef.current.offsetTop;
    }
    if (selectRef.current) selectRef.current.value = format(todayDate, "yyyy-MM");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function jumpTo(value: string) {
    const el = document.getElementById(`m-${value}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // dropdown options, newest first
  const options = useMemo(() => [...months].reverse(), [months]);

  return (
    <div className="rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-muted">Jump to</span>
        <select
          ref={selectRef}
          onChange={(e) => jumpTo(e.target.value)}
          defaultValue={format(todayDate, "yyyy-MM")}
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium focus:border-brand-500 focus:outline-none"
        >
          {options.map((m) => (
            <option key={format(m, "yyyy-MM")} value={format(m, "yyyy-MM")}>
              {format(m, "MMMM yyyy")}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[70vh] overflow-y-auto px-3 py-2 sm:px-4"
      >
        {/* sticky weekday header */}
        <div className="sticky top-0 z-10 grid grid-cols-7 gap-1 bg-card pb-1 pt-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-semibold uppercase text-muted"
            >
              {d}
            </div>
          ))}
        </div>

        {months.map((m) => (
          <Month
            key={monthId(m)}
            month={m}
            today={todayDate}
            statusByDate={statusByDate}
            blackoutFor={blackoutFor}
            onPick={(iso) => router.push(`/day/${iso}`)}
          />
        ))}
      </div>
    </div>
  );
}

function Month({
  month,
  today,
  statusByDate,
  blackoutFor,
  onPick,
}: {
  month: Date;
  today: Date;
  statusByDate: Map<string, string>;
  blackoutFor: (iso: string) => { reason: string | null } | null;
  onPick: (iso: string) => void;
}) {
  // grid of days from the Monday on/before the 1st to the end of the month
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfMonth(month);
  const days: Date[] = [];
  let cur = gridStart;
  while (cur <= end || days.length % 7 !== 0) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  return (
    <div id={monthId(month)} className="scroll-mt-9 pb-4 pt-2">
      <div className="mb-1 px-1 text-sm font-bold">
        {format(month, "MMMM yyyy")}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, month);
          const status = statusByDate.get(iso);
          const isToday = format(today, "yyyy-MM-dd") === iso;
          const away = inMonth ? blackoutFor(iso) : null;
          const dot =
            status === "complete"
              ? "bg-good"
              : status === "upcoming"
                ? "bg-brand-500"
                : status === "skipped"
                  ? "bg-bad"
                  : "";
          return (
            <button
              key={iso}
              onClick={() => onPick(iso)}
              title={away ? `Away — ${away.reason ?? "out of town"}` : undefined}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm transition",
                inMonth ? "hover:bg-canvas" : "text-muted/40",
                away && !isToday && "bg-amber-50 text-amber-700",
                isToday && "bg-ink text-white hover:bg-ink",
                !inMonth && "pointer-events-none opacity-40",
              )}
            >
              <span className={cn(isToday ? "font-bold" : "font-medium")}>
                {format(d, "d")}
              </span>
              {away ? (
                <Plane size={11} className={isToday ? "text-white" : "text-amber-600"} />
              ) : (
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", dot || "bg-transparent")}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
