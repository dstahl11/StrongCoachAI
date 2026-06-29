"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, and } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/current-user";
import { ensureCoachProfile } from "@/lib/coach/template";

export type AdminResult = { ok: boolean; error?: string };

async function adminCount(): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return rows.length;
}

export async function createUser(data: {
  email: string;
  name: string;
  role: "admin" | "user";
  password: string;
}): Promise<AdminResult> {
  await requireAdmin();
  const email = data.email.trim().toLowerCase();
  if (!email || !data.password) return { ok: false, error: "Email and password are required." };
  if (data.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return { ok: false, error: "A user with that email already exists." };

  const [u] = await db
    .insert(users)
    .values({
      email,
      name: data.name.trim(),
      role: data.role === "admin" ? "admin" : "user",
      passwordHash: await hashPassword(data.password),
    })
    .returning();
  await ensureCoachProfile(u.id); // give them their own coach up front
  revalidatePath("/admin");
  return { ok: true };
}

export async function setUserRole(
  userId: number,
  role: "admin" | "user",
): Promise<AdminResult> {
  const me = await requireAdmin();
  if (userId === me.id && role !== "admin") {
    return { ok: false, error: "You can't remove your own admin role." };
  }
  // don't allow demoting the last admin
  if (role !== "admin") {
    const [target] = await db.select().from(users).where(eq(users.id, userId));
    if (target?.role === "admin" && (await adminCount()) <= 1) {
      return { ok: false, error: "There must be at least one admin." };
    }
  }
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/admin");
  return { ok: true };
}

export async function resetPassword(
  userId: number,
  newPassword: string,
): Promise<AdminResult> {
  await requireAdmin();
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, userId));
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUser(userId: number): Promise<AdminResult> {
  const me = await requireAdmin();
  if (userId === me.id) return { ok: false, error: "You can't delete your own account." };
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (target?.role === "admin" && (await adminCount()) <= 1) {
    return { ok: false, error: "There must be at least one admin." };
  }
  // cascades to the user's workouts, coach, etc. via FK onDelete: cascade
  await db.delete(users).where(and(eq(users.id, userId), ne(users.id, me.id)));
  revalidatePath("/admin");
  return { ok: true };
}
