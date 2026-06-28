"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, BarChart3, ListChecks, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/dates";

const NAV = [
  { href: `/day/${todayISO()}`, match: ["/day", "/calendar"], icon: Dumbbell, label: "Workouts" },
  { href: "/coach", match: ["/coach"], icon: MessageCircle, label: "Coach" },
  { href: "/dashboard", match: ["/dashboard"], icon: BarChart3, label: "Dashboard" },
  { href: "/exercises", match: ["/exercises"], icon: ListChecks, label: "Exercises" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      {/* Left icon rail */}
      <nav className="sticky top-0 flex h-screen w-14 flex-col items-center gap-1 border-r border-line bg-card py-3">
        <Link
          href="/calendar"
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white"
          aria-label="StrongCoach"
          title="StrongCoach"
        >
          <Dumbbell size={18} />
        </Link>
        <div className="h-px w-7 bg-line" />
        {NAV.map((item) => {
          const active = item.match.some((m) => pathname.startsWith(m));
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "mt-1 flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                active
                  ? "bg-brand-50 text-brand-600"
                  : "text-muted hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon size={20} />
            </Link>
          );
        })}
      </nav>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-card/80 px-5 backdrop-blur">
          <Link href="/calendar" className="font-semibold tracking-tight">
            Strong<span className="text-brand-600">Coach</span>
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
            DS
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
