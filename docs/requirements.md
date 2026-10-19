# StudyOtt: Requirements (v1)

Final decisions as of 2026-10-18. This replaces the original requirements page.
The database rules described here are implemented in `docs/schema.sql`.

## 1. Product summary

StudyOtt is a study tracker web app for desktop and phone. Users sign in with
Google, time study sessions with a stopwatch (or log them by hand), and see
weekly and lifetime totals by subject. It is built for public release at
**studyott.com**.

Out of scope for v1, but the design must not block it: friends and sharing data.

## 2. Navigation and layout

- Four tabs across the top: **Home**, **Weekly History**, **Lifetime Overview**, **Settings**.
- On small screens the tabs collapse into a menu button.
- Must work well on phones (touch targets ≥ 44px, no horizontal scroll) and desktop.
- Installable as a PWA (home-screen icon, opens full-screen). No offline mode in v1.
- Routes:
  - `/` Home
  - `/history` Weekly History list
  - `/history/[weekStart]` one week, e.g. `/history/2026-10-12` (dedicated page, not a popup)
  - `/lifetime`
  - `/settings`
  - `/privacy`, `/terms` (public)
  - `/login` (public)
  - `/welcome` (one-time, after first sign-in)

## 3. Data

### Study session (entry)

| Field | Rules |
|---|---|
| Duration | Whole minutes, 1 to 1,440 (24h). Stopwatch time is rounded to the nearest minute; under 30 seconds can't be saved ("Sessions need at least 1 minute"). |
| Date | The day the session **started**, in the user's timezone. Stopwatch fills it in; manual entry picks it. No future dates. Not before 2000-01-01. |
| Time | Start time. Stopwatch fills it in; optional for manual entries. |
| Subject | Required. Dropdown (see Subjects). |
| Note | Optional, up to 500 characters, trimmed. Editable before the timer starts and while it is paused. |
| Source | `stopwatch` or `manual` (internal). |
| Created / Updated | Set by the database. Never shown or editable. |

Daily limits: at most 24 hours total and 50 sessions on any one day.

### Subjects

- Defaults for every new user (7): Math, Science, English, History, Computer Science, Languages, Other.
- The dropdown lists the user's active subjects in **most recently used** order, plus a last option, **"+ Add new subject…"**, which can't be removed.
  - "Used" means a subject was just added, a session was saved with it (stopwatch or manual), or a timer started with it. Editing an old entry doesn't count.
  - Subjects never used yet follow, A–Z. For a brand-new user that means all 7 defaults appear alphabetically.
  - Sort: `order by last_used_at desc nulls last, display_name`.
- **Default selection:** the top of the list, which is the most recently used subject.
- **Name formatting:** trim the ends, collapse repeated spaces, and capitalize the first letter of each word. Everything else stays as typed: "linear algebra" → "Linear Algebra", "AP bio" → "AP Bio". Max 40 characters.
- **Matching:** a case-insensitive key (`name_key`) is used for duplicate checks.
  - Adding a name that matches an **active** subject shows "That subject is already in your list."
  - Adding a name that matches a **removed** subject brings that subject back (keeping its history), with the capitalization just typed.
- **Removing** a subject hides it from the dropdown. It is never deleted, so its history and totals stay intact.
- **Limits:** 100 active subjects. At 100, adding shows "You have 100 subjects. Remove one you no longer use to add another." with a link to Settings → Manage subjects. There is also a hidden cap of 500 subjects including removed ones, to stop add-and-remove spam.
- **Old entries on removed subjects:** they still display the removed subject. When editing such an entry, its dropdown shows that subject too (marked "removed"), so it can be kept. New entries and timers can only use active subjects.
- A running timer keeps its subject even if that subject is removed mid-session.

## 4. Stopwatch (Home)

- Controls: **Start**, **Pause**, **Resume**, **Save**, and **Discard** ("restart"; confirmation popup: "Discard this session? This can't be undone.").
- Before starting: choose the subject and an optional note. While paused: subject and note can be edited. While running: both are read-only.
- The display shows HH:MM:SS with terracotta timer accents.

### How time is stored

The timer is stored as **timestamps, not a ticking counter**: `started_at`, `paused_at` (while paused), and `paused_total`. Elapsed time is calculated from these, so a frozen background tab, a closed tab, or a phone sleeping never loses or gains time. All timestamps come from the **database clock**. Each client computes its offset from the `server_now` value the timer functions return, so devices with wrong clocks still agree.

### Cross-device

- One timer per user, stored on the server. Start it on a laptop, stop it on a phone.
- A device refreshes the timer whenever the app is opened or the tab becomes visible again. Instant live sync is not needed in v1.
- Every change sends the timer's `version`. If another device changed it first, the database returns `timer_conflict` and the client refetches and shows the current state ("This timer changed on another device").

### Timer left on by accident: "Welcome back"

- While StudyOtt is open **and visible** with a running timer, the client sends a heartbeat every 5 minutes, plus one when the tab is hidden. Each heartbeat updates `last_active_at`.
- When the app opens or becomes visible, the client first fetches the timer. If it is running and `server_now - last_active_at` exceeds the user's **idle prompt** setting (default 60 minutes, range 15 to 720), it shows a modal **before** sending any new heartbeat. Example: "Your Math timer is still running (3h 12m). You were last here at 2:05 PM." The options are:
  1. **Keep going**
  2. **Stop at 2:05 PM and save** (uses `last_active_at`)
  3. **Edit the time, then save** (enter hours and minutes)
  4. **Discard**
- **Hard cap:** elapsed time stops counting at 24 hours. The display shows 24:00:00 with "Maximum session length reached", and only Save and Discard are available.
- The timer is never stopped automatically. People studying with a locked phone look exactly like an abandoned tab.

## 5. Manual entry and editing

- A round **+** button at the top right of Home and of a week page opens the entry form: duration (hours and minutes), date (defaults to today; on a past week's page, the last day of that week), optional time, subject, and note.
- The day view lists each session with **Edit** (the same form, in a dialog) and **Delete**.
- **Delete is a soft delete.** It shows a toast for 10 seconds: "Session deleted · Undo".
  - Deleted sessions can be restored from Settings → **Recently deleted** for 30 days.
  - After 30 days, a nightly job permanently removes them.
- Edits and deletes update totals immediately.

## 6. Weekly format view (shared component)

- Weeks run **Monday to Sunday** by default (configurable in Settings) and show all 7 days.
- Each day is a card: the day name and date, its sessions (subject, duration, time if set, note preview, Edit and Delete), and a day total. Days with no sessions show a quiet "No sessions".
- Below the days are the **week total** and **per-subject totals** for that week.
- Used in two places: under the stopwatch on Home (current week), and on `/history/[weekStart]`.
- The week page has Previous and Next week links.

## 7. Weekly History

- Lists only weeks that have at least one session, newest first.
- Each week is a rounded card showing the date range (e.g. "10/5/2026 – 10/11/2026"), the total time, and per-subject totals.
- Tapping a card opens `/history/[weekStart]`.
- Paginate or infinite-scroll after 20 weeks.

## 8. Lifetime Overview

- The date range from the **earliest to the latest session date** (session dates, not created dates).
- Lifetime total time.
- Per-subject totals, largest first. Each has a sage-green progress bar and its percentage of the lifetime total.
- Removed subjects with history are included, marked "removed".

## 9. Settings

- **Profile:** username (with a live availability check) and display name.
- **Theme:** System (default; follows the device), Light, or Dark. Applied before first paint, so there is no flash.
- **Timezone:** filled in automatically from the browser on first visit; can be changed.
  - Changing it affects only future stopwatch sessions. Saved dates never shift.
- **Week starts on:** defaults to Monday.
- **Time format:** 12h (default) or 24h.
- **Welcome back after:** 15 to 720 minutes (default 60).
- **Manage subjects:** list, add, remove, restore removed.
- **Recently deleted:** sessions deleted in the last 30 days, each with a Restore button.
- **Export data (CSV):** all sessions, with subject names.
- **Delete account:** requires typing "DELETE" to confirm. It permanently deletes everything immediately, then signs the user out.
- **Sign out.**
- Links to Privacy and Terms.

## 10. Accounts, usernames and auth

- Google sign-in only, via Supabase Auth. No passwords stored.
- **User id:** at first sign-in, Supabase Auth creates a permanent UUID for the user (`auth.users.id`). Every table stores it as `user_id`. Ids never change and are never shown in the UI.
- **First sign-in** (database trigger) creates:
  - a **profile** with an auto-generated username and the Google name and avatar
  - the settings row
  - the 7 default subjects
- **Usernames** (`profiles.username`):
  - 3–20 characters: letters, numbers and `_`, starting with a letter
  - typed in any case, stored lowercase, unique ignoring case
  - some names are reserved (admin, support, studyott, settings, and so on)
  - auto-generated from the first name in the Google account plus 4 digits: "David Cardoso" becomes `david_4821`, and a name that starts with a number gets a "user" prefix
  - changeable any time in Settings → Profile, with a live "available / taken" check
  - the last change time is recorded, so a cooldown can be added when friends ship
- **Display name:** from Google, editable, up to 50 characters.
- **Avatar:** comes from Google and users can't set it, so no arbitrary image URLs are shown to friends later.
- **First visit:** a one-time Welcome screen
  - shows "You're @david_4821. Want a different username?", where the user can accept or change it
  - saves the browser's timezone
  - then sets `user_settings.onboarded_at`
- **Privacy now:** profiles are visible only to their owner. The friends feature will add a policy so friends, and username search, can see username, display name and avatar. It will never expose email or study data unless the user shares it.
- Every page except `/login`, `/privacy` and `/terms` requires sign-in.
- **Local development and automated tests only:** an email-and-password test login against the local Supabase. It is disabled in production config.

## 11. Security

- **Row Level Security** on every table, so users only ever see their own rows.
- All validation and limits are enforced **in Postgres**, because the browser can call the Supabase API directly. App-side checks exist only for friendly messages.
- Composite foreign keys ensure a session or timer can only reference the same user's subjects.
- Users have no DELETE privilege on any table. Subjects are deactivated and sessions are soft-deleted.
- The timer can only change through the `timer_*` database functions.
- **Rate limit:** 60 writes per user per rolling minute, across all tables (`rate_limited`).
- Size limits: note 500 characters, subject name 40, duration 1 to 1,440, plus the daily limits in §3.
- **Secrets:**
  - The Supabase secret key is server-only and used only for account deletion.
  - Secrets live only in `.env.local` (git-ignored) and Vercel environment variables.
- **Security headers:** Content-Security-Policy, `X-Frame-Options: DENY` (or `frame-ancestors 'none'`), Referrer-Policy, Permissions-Policy, and HSTS on production.
- **Dependencies:** pnpm lockfile committed, with Dependabot alerts on.
- **Public repo** (github.com/david-cardosoe/studyott):
  - turn on GitHub secret scanning **push protection**
  - commits use the GitHub no-reply email
  - nothing secret is ever committed. Local seed passwords are local-only and fine to commit.

### Error keys → UI text

Database errors use stable keys in the message, with a hint in plain English. The app shows the hint, or a mapped string:

`username_invalid`, `username_reserved`, `username_taken` (also map Postgres unique-violation `23505` on profiles to "That username is taken"), `subject_exists`, `subject_name_invalid`, `subject_limit_reached`, `subject_total_limit_reached`, `subject_inactive`, `session_date_in_future`, `daily_limit_exceeded`, `daily_session_limit`, `session_too_short`, `duration_invalid`, `timezone_invalid`, `rate_limited`, `timer_already_running`, `timer_not_found`, `timer_conflict`, `timer_not_running`, `timer_not_paused`, `timer_max_reached`, `not_authenticated`.

## 12. Design

| Role | Light | Dark |
|---|---|---|
| Primary accent | `#8EA58C` | `#8EA58C` |
| Background | `#F7F9F6` | `#1A1F19` |
| Surface / cards | `#FFFFFF` | `#242B22` |
| Primary text | `#2D372A` | `#E3E8E1` |
| Secondary text | `#62735E` | `#A4B3A0` |
| Highlight / timer | `#D8A47F` | `#E5BA9E` |

- Primary buttons are sage `#8EA58C` with dark text `#2D372A` in both modes.
- Charts and progress bars use sage.
- Timers, streaks and key highlights use terracotta.
- Dark-mode cards get subtle borders.
- Active nav states are sage-tinted.
- The overall feel is minimal and calm, with rounded cards and buttons.
- **Mascot and logo:** David provides the files. Put them in `public/brand/` as `mascot.png` and `logo.svg`, or whatever formats they come in. Generate the favicon and PWA icons from them.
- **Accessibility:** WCAG AA contrast for text (4.5:1), full keyboard navigation, and visible focus rings.
- **Contrast checks (measured):**
  - Dark text on sage buttons: 4.68 (passes). White on sage: 2.65 (fails), which is why buttons use dark text.
  - Light mode, terracotta `#D8A47F` on the background: 2.1 (fails even for large text). Sage `#8EA58C` as text on white: 2.65 (fails).
  - Dark mode: every color passes.
  - **Approved light-mode text shades:**
    - `--highlight-text: #A56232` for timer digits and terracotta text (4.5:1)
    - `--accent-text: #60785E` for sage links and labels (4.6:1)
  - In dark mode, both tokens equal the normal colors. The original light colors stay for fills, rings, bars and decoration.

## 13. Launch checklist (public release)

- Buy **studyott.com** at an at-cost registrar (Cloudflare or Porkbun) and point it at Vercel.
- Before investing in branding, do a quick USPTO trademark search for "StudyOtt".
- Publish **Privacy Policy** and **Terms** pages. Cover:
  - what is stored: Google name, email and avatar, plus study data
  - why it is stored
  - that data is not sold
  - how to export or delete it
  - the processors: Supabase and Vercel
  - a contact address
- Set up support@studyott.com, forwarded to Gmail (Cloudflare Email Routing is free).
- **Google OAuth consent screen:**
  - app name, logo, home page, privacy and terms links
  - scopes: `openid`, `email`, `profile` only
  - publish the app to Production, then submit for brand verification so the screen shows "StudyOtt" instead of the Supabase project domain
- **Supabase production project:**
  - Free plan to start. It pauses after 7 days of low activity; upgrade to Pro once real users depend on it.
  - Schedule the purge job.
  - Set the auth redirect URLs to `https://studyott.com/**`.
- **Vercel:**
  - Hobby (free) plan for a non-commercial app; Pro if StudyOtt ever earns money.
  - Add the custom domain and the production env vars.
- Error monitoring with Sentry's free tier, and privacy-friendly analytics (optional).
- **Mascot credit:** while the Twemoji otter placeholder is in use, show "Otter graphic by Twemoji, licensed under CC-BY 4.0" in the footer or on the Terms page (see public/brand/CREDITS.md). Consider an original mascot before trademarking the brand.
