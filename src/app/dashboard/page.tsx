import Link from "next/link";
import { Activity, Dumbbell, TrendingUp } from "lucide-react";
import {
  getConsistency,
  getTonnage,
  getStrengthTrend,
} from "@/lib/queries";
import { requireUser } from "@/lib/auth/current-user";
import { todayISO, fromISO, toISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import ConsistencyHeatmap from "@/components/ConsistencyHeatmap";
import { TonnageChart, StrengthTrendChart } from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "6mo", label: "6 months", days: 182 },
  { key: "12mo", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: 3650 },
];

function sinceFor(key: string) {
  const r = RANGES.find((x) => x.key === key) ?? RANGES[2];
  const d = fromISO(todayISO());
  d.setDate(d.getDate() - r.days);
  return toISO(d);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const range = sp.range ?? "6mo";
  const since = sinceFor(range);
  const [consistency, tonnage, trend] = await Promise.all([
    getConsistency(since, user.id),
    getTonnage(since, user.id),
    getStrengthTrend(since, user.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted">davidstahl11@gmail.com</p>
        </div>
        <div className="flex flex-wrap rounded-xl border border-line bg-card p-0.5 text-xs">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/dashboard?range=${r.key}`}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium",
                range === r.key
                  ? "bg-brand-600 text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <Card title="Consistency" icon={<Activity size={18} className="text-good" />}>
        <ConsistencyHeatmap days={consistency} since={since} />
        <Legend />
      </Card>

      <Card title="Tonnage (lbs)" icon={<Dumbbell size={18} className="text-brand-600" />}>
        {tonnage.points.length ? (
          <TonnageChart points={tonnage.points} exercises={tonnage.exercises} />
        ) : (
          <Empty />
        )}
      </Card>

      <Card
        title="Strength trend — estimated 1RM"
        icon={<TrendingUp size={18} className="text-brand-600" />}
      >
        {trend.points.length ? (
          <StrengthTrendChart points={trend.points} exercises={trend.exercises} />
        ) : (
          <Empty />
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-good" /> Completed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-bad" /> Missed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-line" /> Rest
      </span>
    </div>
  );
}

function Empty() {
  return (
    <div className="py-12 text-center text-sm text-muted">
      No data in this range yet.
    </div>
  );
}
