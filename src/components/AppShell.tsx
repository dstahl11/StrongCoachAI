"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  BarChart3,
  ListChecks,
  MessageCircle,
  Shield,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";

type NavUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  initials: string;
};

const NAV = [
  // barbell → calendar (month/list), where you pick a day to edit
  { href: "/calendar", match: ["/day", "/calendar"], icon: Dumbbell, label: "Workouts" },
  { href: "/coach", match: ["/coach"], icon: MessageCircle, label: "Coach" },
  { href: "/dashboard", match: ["/dashboard"], icon: BarChart3, label: "Dashboard" },
  { href: "/exercises", match: ["/exercises"], icon: ListChecks, label: "Exercises" },
];

export default function AppShell({
  user,
  children,
}: {
  user: NavUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = [...NAV];
  if (user.role === "admin") {
    nav.push({ href: "/admin", match: ["/admin"], icon: Shield, label: "Admin" });
  }

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
        {nav.map((item) => {
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-card/80 px-5 backdrop-blur">
          <Link href="/calendar" className="font-semibold tracking-tight">
            Strong<span className="text-brand-600">Coach</span>
          </Link>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white"
              aria-label="Account menu"
            >
              {user.initials}
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-card p-1 shadow-lg">
                  <div className="px-3 py-2">
                    <div className="truncate text-sm font-semibold">
                      {user.name || user.email}
                    </div>
                    <div className="truncate text-xs text-muted">{user.email}</div>
                    {user.role === "admin" && (
                      <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <form action={logout}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
                    >
                      <LogOut size={15} /> Sign out
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
