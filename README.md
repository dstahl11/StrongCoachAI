# StrongCoach — AI Strength Coaching

A strength-training app with an AI coach: plan workouts, log your lifts
set-by-set, track PRs / estimated 1RMs / tonnage / consistency over time, and
train with an AI coach that programs for you and holds you accountable.

## Features

- **Calendar** — a scrollable **month view** (infinite scroll + month/year jump
  dropdown) and a **list view** (week strip + per-day summary), with completion
  dots on every day.
- **CSV import** — bring in workout-history CSV exports from the calendar (or
  `npm run import`); completed workouts without per-set actuals fall back to the
  prescription so they still feed PRs and charts.
- **Exercise library** — searchable catalog; create, **edit**, and **delete**
  (delete is guarded when an exercise has workout history).
- **AI Coach ("Hank")** — chat with a Starting-Strength coach that knows your full training
  history and remembers facts about you (injuries, caps, goals — editable on `/coach/settings`).
  Runs on Claude via Portkey (`@<PORTKEY_INTEGRATION>/<model>`). The coach can:
  - **schedule & adjust** workouts from chat (respecting your weight caps + excluded lifts),
  - **autonomously program** your upcoming Starting-Strength sessions (progressed from your
    real lifts) and keep the calendar filled,
  - honor **blackout days** (travel) — it won't program or nag on them,
  - email a **morning digest** + **missed-workout reminders** via Resend _(needs RESEND keys)_.
- **Workout day view** — exercise cards (A / B / C…) with `N × reps @ weight`
  prescriptions, expandable per-set logging (weight / reps / done), warm-up
  calculator, demo-video links, per-exercise comments, skip, and
  **Mark Complete**.
- **PRs & Estimated 1RMs** — auto-computed per workout (Epley formula) once
  completed.
- **Stats & history** (per exercise) — working-weight line, estimated-1RM line,
  and a PR reference line with 30d / 3mo / 6mo / 1yr / All ranges, plus a dated
  history list.
- **Dashboard** — consistency heatmap, stacked tonnage-by-exercise chart, and an
  estimated-1RM strength-trend chart, all range-filterable.

## Stack

- **Next.js 16** (App Router, React 19, Server Components + Server Actions)
- **Tailwind CSS v4**
- **Drizzle ORM** + **Postgres** (standard `node-postgres` driver — runs against
  any Postgres: local Docker, self-hosted, managed)
- **Recharts** for charts, **lucide-react** for icons, **date-fns** for dates

## Getting started

> **Requires Node ≥ 20.9** (the repo pins `22.14.0` via `.nvmrc`). With nvm:
> `nvm use`. And **Docker** for the database.

```bash
npm install

# Start the Postgres container (see docker-compose.yml):
docker compose up -d

# .env.local points at that container. Push the schema and seed
# ~16 weeks of demo history:
npm run db:push
npm run db:seed

npm run dev          # http://localhost:3000
```

The database lives in a Docker container; `DATABASE_URL` (in `.env.local`,
copied from `.env.example`) is the only thing that needs to change to point at a
different Postgres.

## Scripts

| Script              | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start the dev server                             |
| `npm run build`     | Production build + typecheck                     |
| `npm run db:push`   | Sync the Drizzle schema to Neon                  |
| `npm run db:seed`   | Wipe + reseed demo data (anchored to 2026-06-27) |
| `npm run import -- <csv> [--append]` | Import a workout-history CSV (replace by default) |
| `npm run db:studio` | Open Drizzle Studio                              |

## Data model

`exercises` → `workouts` → `workout_exercises` → `set_groups` (prescriptions)
and `logged_sets` (actual performance). PRs, e1RM, tonnage, and the stats charts
are all derived from `logged_sets`. See `src/db/schema.ts`.

## Notes

- The app's "today" is anchored to **2026-06-27** (`TODAY_ISO` in
  `src/lib/dates.ts`) so the seeded history lines up. Change that constant (and
  reseed) to use the real current date.
- Single-user / personal use: there is no auth yet.
