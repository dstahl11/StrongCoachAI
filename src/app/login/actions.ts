"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  setSessionCookie,
  getSessionToken,
  invalidateSession,
  clearSessionCookie,
} from "@/lib/auth/session";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/calendar") || "/calendar";

  if (!email || !password) return { error: "Enter your email and password." };

  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u || !(await verifyPassword(password, u.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  const session = await createSession(u.id);
  await setSessionCookie(session.id, session.expiresAt);
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, u.id));

  redirect(next.startsWith("/") ? next : "/calendar");
}

export async function logout() {
  const token = await getSessionToken();
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  redirect("/login");
}
