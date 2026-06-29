import Link from "next/link";
import { Dumbbell, CalendarDays, List } from "lucide-react";
import {
  getDaySummaries,
  getAllWorkoutDates,
  getCompletedCount,
} from "@/lib/queries";
import { getBlackouts } from "@/lib/coach/blackouts";
import { requireUser, publicUser } from "@/lib/auth/current-user";
import { weekOf, todayISO, fmt } from "@/lib/dates";
import { fmtScheme } from "@/lib/strength";
import { cn } from "@/lib/utils";
import WeekStrip from "@/components/WeekStrip";
import MonthCalendar from "@/components/MonthCalendar";
import ImportButton from "@/components/ImportButton";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const user = await requireUser();
  const me = publicUser(user);
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "month";
  const selected = sp.date ?? todayISO();

  const completedCount = await getCompletedCount(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Athlete header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-sm font-bold text-ink ring-1 ring-line">
          {me.initials}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold leading-tight">
            {me.name || me.email}
          </div>
          <div className="text-sm text-muted">
            {completedCount} Completed Workouts
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ImportButton />
          <div className="flex rounded-xl border border-line bg-card p-0.5">
            <Link
              href="/calendar?view=month"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
                view === "month"
                  ? "bg-brand-600 text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              <CalendarDays size={16} /> Month
            </Link>
            <Link
              href="/calendar?view=list"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
                view === "list"
                  ? "bg-brand-600 text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              <List size={16} /> List
            </Link>
          </div>
        </div>
      </div>

      {view === "month" ? (
        <MonthCalendar
          statuses={await getAllWorkoutDates(user.id)}
          blackouts={(await getBlackouts(user.id)).map((b) => ({
            startDate: b.startDate,
            endDate: b.endDate,
            reason: b.reason,
          }))}
          today={todayISO()}
        />
      ) : (
        <ListView selected={selected} userId={user.id} />
      )}
    </div>
  );
}

async function ListView({
  selected,
  userId,
}: {
  selected: string;
  userId: number;
}) {
  const summaries = await getDaySummaries(weekOf(selected), userId);
  const day = summaries[selected];
  const status = day?.status;

  return (
    <>
      <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <WeekStrip
          selected={selected}
          summaries={summaries}
          hrefBase="/calendar?view=list&date="
        />
      </div>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">
        {fmt.dayLong(selected)}
      </h2>

      {day ? (
        <Link
          href={`/day/${selected}`}
          className="block rounded-2xl border border-line bg-card shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2 font-semibold">
              <Dumbbell size={16} className="text-brand-600" />
              Workout
            </div>
            <span
              className={
                status === "complete"
                  ? "rounded-full bg-good/10 px-2.5 py-0.5 text-xs font-medium text-good"
                  : "rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600"
              }
            >
              {status === "complete" ? "Completed" : "Upcoming"}
            </span>
          </div>
          <div className="space-y-3 px-4 py-4">
            {day.exercises.map((ex) => (
              <div key={ex.name}>
                <div className="font-semibold">{ex.name}</div>
                <div className="text-sm text-muted">
                  {fmtScheme(ex.sets, ex.reps, ex.weight)}
                </div>
              </div>
            ))}
          </div>
        </Link>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-card px-4 py-10 text-center">
          <p className="text-sm text-muted">No workout scheduled.</p>
          <Link
            href={`/day/${selected}`}
            className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Plan a workout
          </Link>
        </div>
      )}
    </>
  );
}
