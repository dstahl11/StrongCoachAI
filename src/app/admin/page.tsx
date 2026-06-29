import { sql, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { users, workouts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/current-user";
import AdminUsers from "@/components/AdminUsers";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireAdmin();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      workouts: sql<number>`count(${workouts.id})`.mapWith(Number),
      completed: sql<number>`count(${workouts.id}) filter (where ${workouts.status} = 'complete')`.mapWith(Number),
    })
    .from(users)
    .leftJoin(workouts, eq(workouts.userId, users.id))
    .groupBy(users.id)
    .orderBy(asc(users.id));

  return (
    <AdminUsers
      meId={me.id}
      users={rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role as "admin" | "user",
        createdAt: r.createdAt.toISOString(),
        lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
        workouts: r.workouts,
        completed: r.completed,
      }))}
    />
  );
}
