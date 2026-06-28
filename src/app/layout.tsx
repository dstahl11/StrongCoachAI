import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getCurrentUser, publicUser } from "@/lib/auth/current-user";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "StrongCoach — AI Strength Coaching",
  description:
    "Plan workouts, log lifts, track PRs and 1RMs, and train with an AI coach.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full">
        {user ? (
          <AppShell user={publicUser(user)}>{children}</AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
