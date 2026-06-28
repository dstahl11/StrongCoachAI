import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { getSessionToken, validateSessionToken } from "./session";

/** The logged-in user for this request (cached), or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  const session = await validateSessionToken(token);
  if (!session) return null;
  const [u] = await db.select().from(users).where(eq(users.id, session.userId));
  return u ?? null;
});

/** Require a logged-in user; redirects to /login otherwise. */
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** Require an admin; redirects to /login (or home) otherwise. */
export async function requireAdmin(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role !== "admin") redirect("/calendar");
  return u;
}

/** Public-safe shape for passing the user to client components. */
export function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    initials: initialsFor(u.name || u.email),
  };
}

function initialsFor(s: string): string {
  const parts = s.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "??").toUpperCase();
}
