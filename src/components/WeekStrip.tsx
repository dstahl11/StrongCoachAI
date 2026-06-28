import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmt, weekOf, todayISO } from "@/lib/dates";
import type { DaySummary } from "@/lib/queries";

export default function WeekStrip({
  selected,
  summaries,
  hrefBase = "/calendar?date=",
}: {
  selected: string;
  summaries: Record<string, DaySummary>;
  hrefBase?: string;
}) {
  const days = weekOf(selected);
  const today = todayISO();
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((iso) => {
        const isSel = iso === selected;
        const isToday = iso === today;
        const s = summaries[iso];
        const dot =
          s?.status === "complete"
            ? "bg-good"
            : s?.status === "upcoming"
              ? "bg-brand-500"
              : "bg-transparent";
        return (
          <Link
            key={iso}
            href={`${hrefBase}${iso}`}
            className="flex flex-col items-center gap-1 py-1"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                isSel
                  ? "bg-ink text-white"
                  : isToday
                    ? "text-brand-600"
                    : "text-ink",
              )}
            >
              {fmt.dom(iso)}
            </span>
            <span className="text-[11px] font-medium text-muted">
              {fmt.dow(iso)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
