import bcrypt from "bcryptjs";
import { eq, isNull } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  workouts,
  coachProfile,
  coachMemories,
  chatMessages,
  blackoutDays,
  coachEvents,
} from "./schema";

/**
 * Create (or update) an admin user and assign all currently-unowned data to
 * them. Idempotent.
 *
 *   npm run db:create-admin -- <email> <password> [name]
 */
async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const password = process.argv[3] || "";
  const name = process.argv[4] || "Admin";

  if (!email || !password) {
    console.error("Usage: npm run db:create-admin -- <email> <password> [name]");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let [admin] = await db.select().from(users).where(eq(users.email, email));
  if (!admin) {
    [admin] = await db
      .insert(users)
      .values({ email, passwordHash, name, role: "admin" })
      .returning();
    console.log(`Created admin ${email} (id ${admin.id}).`);
  } else {
    await db
      .update(users)
      .set({ passwordHash, role: "admin", name })
      .where(eq(users.id, admin.id));
    console.log(`Updated existing admin ${email} (id ${admin.id}).`);
  }

  // Backfill all unowned rows to this admin.
  const backfills: [string, () => Promise<unknown>][] = [
    ["workouts", () => db.update(workouts).set({ userId: admin.id }).where(isNull(workouts.userId))],
    ["coach_profile", () => db.update(coachProfile).set({ userId: admin.id }).where(isNull(coachProfile.userId))],
    ["coach_memories", () => db.update(coachMemories).set({ userId: admin.id }).where(isNull(coachMemories.userId))],
    ["chat_messages", () => db.update(chatMessages).set({ userId: admin.id }).where(isNull(chatMessages.userId))],
    ["blackout_days", () => db.update(blackoutDays).set({ userId: admin.id }).where(isNull(blackoutDays.userId))],
    ["coach_events", () => db.update(coachEvents).set({ userId: admin.id }).where(isNull(coachEvents.userId))],
  ];
  for (const [label, run] of backfills) {
    await run();
    console.log(`Backfilled ${label} → admin.`);
  }

  console.log("Admin + backfill complete ✅");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
