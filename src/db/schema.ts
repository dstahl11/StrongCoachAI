import {
  pgTable,
  serial,
  integer,
  text,
  date,
  timestamp,
  boolean,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Exercise catalog. One row per movement (e.g. "Safety Squat Bar Squat").
 */
export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  demoUrl: text("demo_url"),
  muscleGroup: text("muscle_group"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * A training day. For personal use we key one workout per calendar date,
 * but the schema allows several (status drives the calendar dots).
 */
export const workouts = pgTable(
  "workouts",
  {
    id: serial("id").primaryKey(),
    // owner; nullable during migration, backfilled to the admin
    userId: integer("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    date: date("date").notNull(),
    title: text("title").notNull().default("Workout"),
    // 'upcoming' | 'complete' | 'skipped'
    status: text("status").notNull().default("upcoming"),
    // who created this workout: 'manual' | 'import' | 'coach'
    source: text("source").notNull().default("manual"),
    notes: text("notes"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("workouts_date_idx").on(t.date), index("workouts_user_idx").on(t.userId)],
);

/**
 * An exercise as it appears within a workout, ordered A / B / C ... via position.
 */
export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: serial("id").primaryKey(),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
    comment: text("comment"),
    videoUrl: text("video_url"),
    skipped: boolean("skipped").notNull().default(false),
  },
  (t) => [index("workout_exercises_workout_idx").on(t.workoutId)],
);

/**
 * A prescribed set-line: "N × reps @ weight" (e.g. 2 × 3 @ 267.5).
 * An exercise can have several stacked set-lines.
 */
export const setGroups = pgTable("set_groups", {
  id: serial("id").primaryKey(),
  workoutExerciseId: integer("workout_exercise_id")
    .notNull()
    .references(() => workoutExercises.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  weight: numeric("weight", { precision: 7, scale: 2 }).notNull(),
  isWarmup: boolean("is_warmup").notNull().default(false),
});

/**
 * An actual logged set (what was performed). Used for PRs, e1RM, tonnage,
 * and the stats history. weight/reps may differ from the prescription.
 */
export const loggedSets = pgTable(
  "logged_sets",
  {
    id: serial("id").primaryKey(),
    workoutExerciseId: integer("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    setGroupId: integer("set_group_id").references(() => setGroups.id, {
      onDelete: "set null",
    }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps").notNull(),
    weight: numeric("weight", { precision: 7, scale: 2 }).notNull(),
    completed: boolean("completed").notNull().default(true),
    rpe: numeric("rpe", { precision: 3, scale: 1 }),
    videoUrl: text("video_url"),
  },
  (t) => [index("logged_sets_we_idx").on(t.workoutExerciseId)],
);

// ---- Relations (for relational queries) ----

export const workoutsRelations = relations(workouts, ({ many }) => ({
  exercises: many(workoutExercises),
}));

export const workoutExercisesRelations = relations(
  workoutExercises,
  ({ one, many }) => ({
    workout: one(workouts, {
      fields: [workoutExercises.workoutId],
      references: [workouts.id],
    }),
    exercise: one(exercises, {
      fields: [workoutExercises.exerciseId],
      references: [exercises.id],
    }),
    setGroups: many(setGroups),
    loggedSets: many(loggedSets),
  }),
);

export const exercisesRelations = relations(exercises, ({ many }) => ({
  workoutExercises: many(workoutExercises),
}));

export const setGroupsRelations = relations(setGroups, ({ one }) => ({
  workoutExercise: one(workoutExercises, {
    fields: [setGroups.workoutExerciseId],
    references: [workoutExercises.id],
  }),
}));

export const loggedSetsRelations = relations(loggedSets, ({ one }) => ({
  workoutExercise: one(workoutExercises, {
    fields: [loggedSets.workoutExerciseId],
    references: [workoutExercises.id],
  }),
}));

// ---------------------------------------------------------------------------
// Auth: users + sessions
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default(""),
  // 'admin' | 'user'
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const sessions = pgTable(
  "sessions",
  {
    // random opaque token (also the cookie value)
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// AI Coach
// ---------------------------------------------------------------------------

/** One coach per user — identity, personality, and config. */
export const coachProfile = pgTable("coach_profile", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Coach"),
  // the editable "soul" — personality / voice / coaching philosophy
  persona: text("persona").notNull().default(""),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  // email
  remindersEnabled: boolean("reminders_enabled").notNull().default(false),
  digestEnabled: boolean("digest_enabled").notNull().default(false),
  reminderEmail: text("reminder_email"),
  missedGraceDays: integer("missed_grace_days").notNull().default(1),
  inactivityDays: integer("inactivity_days").notNull().default(3),
  digestHour: integer("digest_hour").notNull().default(7),
  // programming
  autonomousProgramming: boolean("autonomous_programming").notNull().default(false),
  // jsonb: { daysOfWeek:number[], increments:{[lift]:number}, caps:{[lift]:number},
  //          excluded:string[], lifts:string[] }
  programConfig: jsonb("program_config"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Long-term facts the coach remembers about the athlete. */
export const coachMemories = pgTable("coach_memories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  // 'injury' | 'constraint' | 'preference' | 'goal' | 'note'
  kind: text("kind").notNull().default("note"),
  content: text("content").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Date ranges the athlete is unavailable (travel etc.). Inclusive. */
export const blackoutDays = pgTable("blackout_days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Persisted chat transcript between the athlete and the coach. */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    // 'user' | 'assistant' | 'tool'
    role: text("role").notNull(),
    content: text("content").notNull().default(""),
    toolCalls: jsonb("tool_calls"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_messages_created_idx").on(t.createdAt)],
);

/** Audit log of coach actions (emails sent, checks, program updates) + dedupe. */
export const coachEvents = pgTable(
  "coach_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    // 'reminder' | 'digest' | 'check' | 'program_update' | 'chat_action'
    type: text("type").notNull(),
    channel: text("channel"), // 'email' | 'system'
    subject: text("subject"),
    body: text("body"),
    status: text("status").notNull().default("sent"), // 'sent' | 'failed' | 'skipped'
    // dedupe key, e.g. "miss:2026-06-27" so we never nudge twice
    dedupeKey: text("dedupe_key"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("coach_events_dedupe_idx").on(t.dedupeKey)],
);

export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type SetGroup = typeof setGroups.$inferSelect;
export type LoggedSet = typeof loggedSets.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type CoachProfile = typeof coachProfile.$inferSelect;
export type CoachMemory = typeof coachMemories.$inferSelect;
export type BlackoutDay = typeof blackoutDays.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type CoachEvent = typeof coachEvents.$inferSelect;
