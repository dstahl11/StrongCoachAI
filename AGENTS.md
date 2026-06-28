<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# StrongCoach — project notes

- **Node ≥ 20.9 required** (system default may be 18). Use `nvm use` (`.nvmrc` pins 22.14.0)
  or prefix: `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`.
- **DB:** Postgres via Drizzle + standard `node-postgres` (`pg`) driver, so it runs against
  any Postgres. Local dev uses a Docker container (`docker compose up -d`, see
  `docker-compose.yml`). Connection string in `.env.local` (gitignored), template in
  `.env.example`. Target deployment is a Docker container (NOT Vercel/Neon).
  - `npm run db:push` — sync schema (`src/db/schema.ts`)
  - `npm run db:seed` — wipe + reseed; uses `--env-file=.env.local` because the seed
    imports the db client (ESM hoisting means `dotenv` config runs too late otherwise).
- **"Today" is hard-coded to 2026-06-27** (`TODAY_ISO` in `src/lib/dates.ts`) to match the
  seeded history. Pages use `dynamic = "force-dynamic"` since data is per-request.
- **Architecture:** Server Components fetch via `src/lib/queries.ts`; mutations are Server
  Actions in `src/app/actions.ts`; interactive bits (logging, charts, modal) are Client
  Components. PRs / e1RM / tonnage / charts are all derived from `logged_sets`.
