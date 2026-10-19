# StudyOtt

A study tracker web app: stopwatch and manual study sessions, weekly history,
lifetime stats, and Google sign-in. Public release target: studyott.com.

- Full spec: @docs/requirements.md (re-read the relevant section before building a feature)
- Build order and phase checklists: `docs/build-plan.md`
- Schema source of truth: `supabase/migrations/` (seeded from `docs/schema.sql`)

## Stack

- Next.js (App Router) + TypeScript (strict), pnpm
- Tailwind CSS + shadcn/ui. Colors come from CSS variables in `app/globals.css` (see Design tokens below)
- Supabase: Postgres, Auth (Google), local stack via the Supabase CLI and Docker
- Data access: `@supabase/supabase-js` + `@supabase/ssr` with types from `supabase gen types`. **No ORM.**
- Validation: Zod on every server action and route-handler input
- Tests: Vitest (unit), Playwright (end-to-end), pgTAP via `supabase test db` (database and RLS)
- Hosting: Vercel. Production DB: Supabase cloud

## Commands

- `pnpm dev`: run the app at http://localhost:3000
- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm test:e2e`
- `pnpm db:start` / `pnpm db:stop`: local Supabase (Docker Desktop must be running)
- `pnpm db:reset`: rebuild the local DB from migrations and seed
- `pnpm db:test`: pgTAP tests in `supabase/tests/`
- `pnpm db:types`: regenerate `lib/database.types.ts` after any migration

Before saying a task is done, run lint, typecheck, unit tests, and (if the DB
changed) `db:reset` then `db:test`. For UI work, open the page with Playwright or the
preview, check both themes and a 390px-wide phone viewport.

## Architecture rules

- **The database enforces the rules.** The browser can call the Supabase API
  directly, so limits, validation and ownership checks live in Postgres
  (constraints, triggers, RLS, functions). App checks only give friendlier messages.
- Every table has RLS on. Policies use `(select auth.uid())`. Never disable RLS
  and never use the secret key to work around a policy.
- The Supabase **secret key** is used in exactly one place: account deletion
  (server-only module that imports `server-only`). Never in client code, never `NEXT_PUBLIC_`.
- Schema changes are new migration files only (`pnpm supabase migration new <name>`).
  Never edit a migration that has been pushed to production.
- Read study sessions through the `visible_study_sessions` view. Delete means
  `update ... set deleted_at = now()`, and Undo means setting it back to null.
- The stopwatch changes only through the `timer_*` RPC functions. Never write
  `active_timers` directly. Elapsed time is derived from timestamps. Never store a
  ticking counter. Use the `server_now` offset for display; never trust the device clock.
- Subjects: add through the `add_subject` RPC (it handles normalization, duplicates
  and reactivation). Remove = `is_active = false`. Dropdown order:
  `last_used_at desc nulls last, display_name`; the default selection is the top item.
- Identity: `auth.users.id` (UUID) is the permanent user id. `profiles` holds the
  username (lowercase, unique), display name and Google avatar. Users can't set `avatar_url`.
  Never show emails or ids to other users.
- Database errors carry stable keys (e.g. `subject_exists`) in the message and
  a readable `hint`. Map them in one place (`lib/errors.ts`).
- Dates: `session_date` is a calendar date in the user's timezone (from
  `user_settings.timezone`). Do date math with date-only values. Never convert
  a `session_date` through `Date` in UTC (off-by-one bugs).
- Server Components fetch data. Mutations are Server Actions that return
  `{ ok: true, data } | { ok: false, error }`, then `revalidatePath`.
- Keep `user_id` on every table. Future friends/sharing will build on it.

## Conventions

- Files kebab-case; components PascalCase; one component per file in `components/`.
- Feature folders: `app/(app)/...` for signed-in pages, `app/(public)/...` for login/privacy/terms.
- Accessible by default: real `<button>`s, labels on inputs, focus rings, 44px touch targets.
- Copy is short and friendly. Confirm destructive actions; prefer Undo toasts for deletes.
- No new dependency without a one-line reason in the PR/commit message.
- Commit at the end of each working step with a clear message. One phase = one branch.

## Design tokens

| Token | Light | Dark |
|---|---|---|
| `--accent` (sage: buttons, active, progress, charts) | #8EA58C | #8EA58C |
| `--background` | #F7F9F6 | #1A1F19 |
| `--surface` (cards, modals) | #FFFFFF | #242B22 |
| `--text` | #2D372A | #E3E8E1 |
| `--text-muted` | #62735E | #A4B3A0 |
| `--highlight` (timer, streaks) | #D8A47F | #E5BA9E |
| `--accent-text` (sage used as text) | #60785E | #8EA58C |
| `--highlight-text` (timer digits, terracotta text) | #A56232 | #E5BA9E |

- Primary buttons: `--accent` background with #2D372A text in **both** modes (white text fails contrast).
- `--accent` and `--highlight` are for fills, rings, bars and decoration. Whenever sage
  or terracotta is used as **text**, use `--accent-text` / `--highlight-text` (light-mode
  originals fail contrast).
- Dark-mode cards get a subtle 1px border. Style: minimal, calm, rounded.
- Theme: `system` | `light` | `dark`, applied before first paint (no flash).

## Windows notes

Development is on native Windows. Claude Code uses Git Bash. Use forward
slashes in scripts, keep line endings LF (`.gitattributes`), and use
cross-platform npm scripts (no bash-only syntax in package.json).
