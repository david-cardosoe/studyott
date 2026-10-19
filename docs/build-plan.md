# StudyOtt: Build Plan

Each phase gets one Claude Code session. Use one git branch per phase and merge to `main` when the phase is done.

## How to run each phase

1. In `C:\dev\studyott`, run `git switch -c phase-N-name`. Phase 0 is the exception, because the repo doesn't exist yet. Its prompt creates `main` first and then the branch.
2. Start Claude Code by running `claude`, or use the Code tab in the desktop app. Press **Shift+Tab** until it shows **plan mode**.
3. Paste the phase prompt below.
4. Read the plan Claude proposes and push back on anything off. Then let it build.
5. Check the **Done when** list yourself in the browser.
6. Merge into `main` and push. After Phase 9, every push deploys automatically.
7. Run `/clear` before the next phase so each phase starts with a fresh context.

Docker Desktop must be running for any phase that touches the database (Phase 1 onward).

---

## Phase 0: Scaffold

**Prompt**

> Read CLAUDE.md and docs/requirements.md. Scaffold the project in this folder. create-next-app accepts the existing `docs/` folder but refuses a folder containing `CLAUDE.md`, so move `CLAUDE.md` into `docs/` first and move it back afterwards. Set it up with:
> - Next.js (latest stable, App Router, TypeScript strict, Tailwind, ESLint, `app/` directory, no `src/`), using pnpm
> - shadcn/ui
> - Vitest and Playwright, with one smoke test each
> - Prettier
> - `.gitattributes` (`* text=auto eol=lf`)
> - `.gitignore`, including `.env*.local`
> - `.env.example`
>
> Add these package.json scripts: dev, build, lint, typecheck, test, test:e2e, db:start, db:stop, db:reset, db:test and db:types. The db:* scripts call the Supabase CLI, which should be installed as a devDependency (`supabase`).
>
> Set up git:
> - run `git init` on `main` and make the first commit
> - then create and switch to a `phase-0-scaffold` branch
> - create a **public** GitHub repo `studyott` with `gh repo create studyott --public --source . --push`, then turn on secret scanning push protection with `gh api -X PATCH repos/{owner}/studyott -f security_and_analysis[secret_scanning][status]=enabled -f security_and_analysis[secret_scanning_push_protection][status]=enabled`
>
> Don't build any features yet.

**Done when**

- [ ] `pnpm dev` shows the starter page, and `pnpm lint`, `pnpm typecheck` and `pnpm test` each pass
- [ ] `pnpm test:e2e` passes
- [ ] The repo exists on GitHub and `.env.local` is not committed

---

## Phase 1: Database

**Prompt**

> Phase 1 from docs/build-plan.md.
> 1. Run `supabase init` and create a migration from docs/schema.sql unchanged.
> 2. Configure local auth in supabase/config.toml:
>    - enable email/password sign-in for **local only** (dev test login)
>    - add the `[auth.external.google]` block with secrets from env, disabled until Phase 2
> 3. Write a seed file that creates two test users (test1@studyott.local, test2@studyott.local; password in .env.example) with a few weeks of sample sessions. Mark them onboarded so tests skip the Welcome page.
> 4. Port every check in docs/schema-test.mjs to pgTAP tests in supabase/tests/, including the RLS isolation tests.
> 5. Generate types into lib/database.types.ts.
>
> Run db:reset and db:test until everything passes.

**Done when**

- [ ] `pnpm db:start`, then `pnpm db:reset`, then `pnpm db:test`: all green
- [ ] Supabase Studio (http://localhost:54323) shows the tables, with seed data for the two test users

---

## Phase 2: Sign-in

**You do first: create a Google OAuth client** (about 15 minutes, free)

1. Go to console.cloud.google.com and create a project named **StudyOtt**.
2. Open **Google Auth Platform**, then **Branding**:
   - App name: StudyOtt
   - Support email: your Gmail
   - Audience: **External**
3. Open **Data Access** and add these scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
4. Open **Clients**, then **Create client**, then **Web application**:
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback`. This is the local Supabase address. You'll add the production one in Phase 9.
5. Copy the Client ID and secret into `.env.local`. Use the variable names from `.env.example`.
6. While the app is in Testing mode, open **Audience** and add your Gmail as a test user.

**Prompt**

> Phase 2. Implement auth with @supabase/ssr, following the current Supabase Next.js server-side auth guide:
> - Google sign-in on /login, with a StudyOtt-branded page
> - the auth callback route
> - session refresh on every request
> - protected `(app)` routes that redirect to /login
> - a sign-out action
>
> Build a one-time `/welcome` page (requirements §10). Signed-in users whose `user_settings.onboarded_at` is null get redirected to it. It:
> - shows their auto-generated username and lets them keep it or change it, with a live `username_available` check
> - saves the browser timezone (Intl API)
> - sets `onboarded_at`, then goes to Home
>
> Add a **dev-only** email/password login form that renders only when NODE_ENV is development and local auth is enabled. Playwright uses it.
>
> Add an e2e test covering sign-in, landing on Home, sign-out, and the redirect to /login.

**Done when**

- [ ] Signing in with Google locally works and lands on Home
- [ ] First sign-in lands on the Welcome page with a username like `david_4821`. You can change it, and the next visit goes straight to Home.
- [ ] Your Google account shows a profile row and 7 default subjects in Studio
- [ ] Going to `/` signed out redirects to /login
- [ ] The e2e auth test passes using the dev login

---

## Phase 3: App shell and theme

**Prompt**

> Phase 3:
> - Build the app shell: the top tab nav (Home, Weekly History, Lifetime Overview, Settings) with sage active states, collapsing into a menu button below 640px.
> - Add the design tokens from CLAUDE.md as CSS variables, mapped into Tailwind/shadcn.
> - Add theme support (system/light/dark) from `user_settings.theme_mode`, applied before first paint with no flash, and a cookie fallback for signed-out pages.
> - Add a toast system, placeholder pages for each tab, and PWA basics (manifest, icons from public/brand/ with placeholders if missing, theme-color).
>
> Check both themes at 390px and 1280px, and screenshot them for me.

**Done when**

- [ ] The nav works on a phone and on desktop
- [ ] Changing your OS theme flips the app with no flash on reload
- [ ] Contrast looks right in both themes
- [ ] On a phone, Chrome offers "Install app" / "Add to Home Screen"

---

## Phase 4: Subjects, manual entry, and the week view

**Prompt**

> Phase 4, per requirements §3, §5 and §6:
> - **Subject picker:** active subjects in most-recently-used order (`last_used_at desc nulls last, display_name`), with "+ Add new subject…" last. The default selection is the top item. A newly added subject becomes selected. Show friendly messages for every subject error key.
> - **Manual entry:** the round + button opens the entry form (hours+minutes, date, optional time, subject, note with a character counter), with Zod validation.
> - **WeeklyView component:** a 7-day grid starting on the user's `week_start`, with day cards, per-session Edit/Delete, day totals, a week total, and per-subject totals. Put it under a stopwatch placeholder on Home, for the current week.
> - **Delete:** soft delete with a 10-second Undo toast.
> - **Editing old entries:** the dropdown includes the entry's removed subject, marked "removed".
>
> Put all error-key → message mapping in lib/errors.ts.
>
> Tests:
> - unit tests for week-boundary date math, including week_start ≠ Monday and DST weeks
> - an e2e test for add, edit, delete and undo

**Done when**

- [ ] You can add, edit, delete and undo entries on a phone-sized screen
- [ ] Adding "ap bio" shows "AP Bio"
- [ ] Adding "math" says it already exists
- [ ] Totals are correct

---

## Phase 5: Stopwatch (cross-device + Welcome back)

**Prompt**

> Phase 5, per requirements §4. Build the stopwatch on Home using only the timer_* RPCs.
> - **Display:** derive from started_at, paused_at, paused_total and the server_now offset. Use requestAnimationFrame or a 1s interval for display only, with terracotta styling.
> - **Controls:**
>   - Start, Pause, Resume and Save
>   - Discard, with a confirmation dialog
>   - subject and note editable before start and while paused
> - **Sync:**
>   - refetch on focus and on visibilitychange
>   - heartbeat every 5 minutes while visible, plus once on hide (use fetch keepalive)
>   - handle `timer_conflict` by refetching and showing a toast
> - **Welcome back modal:** on open or when the tab becomes visible, call timer_get FIRST. If the timer is running and the gap exceeds idle_prompt_minutes, show the 4 options. Only resume heartbeats after the user chooses.
> - **24h cap:** show the cap state with only Save and Discard.
> - **Accessibility:** screen readers announce state changes (start, pause and save) but not every second.
>
> Tests:
> - unit tests for elapsed-time math, including the clock-skew offset
> - e2e tests for start → pause → resume → save, and for the Welcome Back flow (simulate by updating last_active_at through a test-only helper against the local DB)

**Done when**

- [ ] Start a timer on your PC, open the app on your phone (local network URL), and it shows the same time
- [ ] Pausing on the phone shows as paused on the PC after you switch back to it
- [ ] Closing the tab for longer than the idle setting shows Welcome back on return

---

## Phase 6: Weekly History

**Prompt**

> Phase 6, per requirements §7. Build /history (week cards, newest first, totals and per-subject totals, paginated after 20 weeks) and /history/[weekStart] (the WeeklyView for that week, with Previous/Next links and the + button).
>
> Add a SQL function `get_week_summaries(p_limit, p_before)` in a new migration. It should be security invoker and read visible_study_sessions, grouping weeks by the user's week_start. Add pgTAP tests.
>
> Validate weekStart in the URL and show a 404 for bad values.

**Done when**

- [ ] The seed users' weeks all appear with correct totals
- [ ] Opening a week and editing an entry updates both pages

---

## Phase 7: Lifetime Overview

**Prompt**

> Phase 7, per requirements §8. Add a migration with `get_lifetime_stats()` (security invoker) returning the earliest and latest session_date, the lifetime total, and per-subject totals including removed subjects. Build /lifetime with sage progress bars and percentages, plus an empty state. Add pgTAP and e2e tests.

**Done when**

- [ ] The numbers match the sum of your weeks
- [ ] A removed subject still shows with "removed"

---

## Phase 8: Settings

**Prompt**

> Phase 8, per requirements §9:
> - **Profile:** username (live availability check, friendly messages for username_* errors) and display name.
> - **Preferences:** theme, timezone picker, week start, time format and idle prompt minutes.
> - **Manage subjects:** list, add, remove and restore. Restore uses add_subject, or reactivate directly.
> - **Recently deleted:** last 30 days, with Restore.
> - **CSV export:** a route handler that streams all of the user's sessions.
> - **Delete account:** type DELETE to confirm, then a server action using the secret key in a server-only module, then sign out.
> - **Sign out**, and Privacy/Terms links.
>
> Add the purge job as a migration that enables pg_cron and schedules `private.purge_deleted_sessions()` nightly, as commented in schema.sql.
>
> Add e2e tests for each settings section. The delete-account test uses test2 and re-seeds afterwards.

**Done when**

- [ ] Every setting persists across devices
- [ ] The CSV opens in Excel
- [ ] Deleting test2 removes all of its rows

---

## Phase 9: Deploy

**You do first**

1. **Supabase.** Sign up at supabase.com with GitHub and create a project named `studyott-prod` in region **West US**. Save the database password in a password manager.
2. **Vercel.** Sign up at vercel.com with GitHub and import the `studyott` repo. Don't add environment variables yet; Claude will list them.
3. **Google Cloud.** Add these to your OAuth client:
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Authorized JavaScript origins: your Vercel URL, and later `https://studyott.com`

**Prompt**

> Phase 9. Walk me through, and run the CLI parts of, deploying to production:
> - `supabase link` to studyott-prod, then `supabase db push`
> - enable Google in the prod Auth settings (I'll paste the keys into the dashboard myself)
> - set Site URL and redirect URLs
> - confirm email/password sign-in is OFF in prod
> - list the exact Vercel environment variables to add (mark which are secret)
> - add security headers in next.config (CSP, frame-ancestors, Referrer-Policy, Permissions-Policy and HSTS)
>
> Verify the production deploy by signing in, then add a smoke e2e test that runs against preview URLs.

**Done when**

- [ ] You can sign in on the Vercel URL from your phone and use every tab
- [ ] Pushing to `main` deploys automatically

---

## Phase 10: Launch

**You do first:** ~~buy studyott.com~~ (done 2026-10-19). Do a USPTO trademark search, and set up support@studyott.com email forwarding if not done yet.

**Prompt**

> Phase 10, per requirements §13:
> - Connect studyott.com to Vercel (tell me the DNS records) and update the Supabase and Google URLs.
> - Write Privacy Policy and Terms pages in plain English, covering what we store and why, the processors, export and delete, and the contact address support@studyott.com. Flag anything I should have a lawyer glance at.
> - Set up Sentry (free tier).
> - Prepare everything Google needs for brand verification, then tell me what to click.
> - Run a final review:
>   - security: RLS tests, headers, secrets scan
>   - accessibility: axe on every page
>   - Lighthouse: mobile scores

**Done when**

- [ ] https://studyott.com works
- [ ] Google's sign-in screen says StudyOtt
- [ ] Privacy and Terms are live
- [ ] You've invited a friend to try it
