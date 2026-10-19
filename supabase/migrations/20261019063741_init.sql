-- =====================================================================
-- StudyOtt: initial database schema (draft v1, 2026-10-18)
--
-- Phase 1 of docs/build-plan.md copies this file into
-- supabase/migrations/<timestamp>_init.sql. Targets Supabase Postgres 15+.
--
-- Security model
--   * Row Level Security (RLS) is on for every table: a user only ever sees
--     and changes their own rows.
--   * The browser can reach Postgres directly through the Supabase Data API
--     (the publishable key is public), so every limit and validation rule
--     lives HERE, not only in the Next.js app. App-side checks are for
--     friendly messages; these are the real guarantees.
--   * Rows are never hard-deleted by users: subjects are deactivated and
--     sessions are soft-deleted (purged after 30 days).
--   * The running timer can only change through the timer_* functions, which
--     use the database clock (now()) so every device agrees on the time.
--
-- Errors raised here use stable message keys (e.g. 'subject_exists') with a
-- human-readable HINT. The app maps keys to UI text; see docs/requirements.md.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------

-- created_at / updated_at are always set by the database, never the client.
create or replace function private.set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- "  linear   algebra " -> "Linear Algebra";  "AP bio" -> "AP Bio".
-- Trims, collapses whitespace, capitalizes the first letter of each word,
-- and leaves the rest of each word exactly as typed.
create or replace function private.normalize_subject_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(upper(left(w, 1)) || substr(w, 2), ' ' order by ord)
  from regexp_split_to_table(coalesce(p_name, ''), '\s+') with ordinality as t (w, ord)
  where w <> ''
$$;

create or replace function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using hint = 'Please sign in again.';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  -- display_name is already normalized by trigger, so lowercasing is enough
  name_key     text generated always as (lower(display_name)) stored,
  is_active    boolean not null default true,
  -- dropdown order: most recently used first (set when added, when a session
  -- is saved, and when a timer starts); never-used subjects follow A-Z
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint subjects_user_name_key unique (user_id, name_key),
  -- lets other tables prove a subject belongs to the same user
  constraint subjects_id_user_key unique (id, user_id)
);

create index subjects_user_recent_idx
  on public.subjects (user_id, last_used_at desc nulls last, display_name)
  where is_active;

-- Who a user is to other people. user_id is the permanent id: a UUID that
-- Supabase Auth creates at first sign-in and every table references.
-- Usernames can change; ids never do. Future friends features key on user_id
-- and let people find each other by username.
create table public.profiles (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  -- stored lowercase, so uniqueness is case-insensitive
  username            text not null unique
                        check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  display_name        text check (char_length(display_name) <= 50),
  avatar_url          text check (char_length(avatar_url) <= 500),  -- from Google; users can't set it
  username_changed_at timestamptz,  -- for a change cooldown once friends exist
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.user_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  theme_mode          text not null default 'system'
                        check (theme_mode in ('system', 'light', 'dark')),
  timezone            text not null default 'UTC',
  -- null until the first-visit welcome (timezone from browser, confirm username)
  onboarded_at        timestamptz,
  -- ISO weekday the week starts on: 1 = Monday ... 7 = Sunday
  week_start          smallint not null default 1 check (week_start between 1 and 7),
  time_format         text not null default '12h' check (time_format in ('12h', '24h')),
  -- "Welcome back" prompt shows when a running timer was unattended this long
  idle_prompt_minutes integer not null default 60
                        check (idle_prompt_minutes between 15 and 720),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id       uuid not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  -- the day the session STARTED, in the user's timezone
  session_date     date not null check (session_date >= date '2000-01-01'),
  session_time     time,                       -- optional for manual entries
  note             text check (char_length(note) <= 500),
  source           text not null default 'manual' check (source in ('stopwatch', 'manual')),
  deleted_at       timestamptz,                -- soft delete; purged after 30 days
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint study_sessions_subject_fk
    foreign key (subject_id, user_id)
    references public.subjects (id, user_id)
    on delete cascade
);

create index study_sessions_user_date_idx
  on public.study_sessions (user_id, session_date)
  where deleted_at is null;

create index study_sessions_deleted_at_idx
  on public.study_sessions (deleted_at)
  where deleted_at is not null;

-- One row per user while a stopwatch exists (running or paused).
-- Elapsed = (coalesce(paused_at, now()) - started_at) - paused_total, capped at 24h.
create table public.active_timers (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  subject_id     uuid not null,
  note           text check (char_length(note) <= 500),
  started_at     timestamptz not null,
  paused_at      timestamptz,                         -- non-null while paused
  paused_total   interval not null default interval '0',
  last_active_at timestamptz not null,                -- last time a device showed the timer
  version        integer not null default 1,          -- optimistic lock across devices
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint active_timers_subject_fk
    foreign key (subject_id, user_id)
    references public.subjects (id, user_id)
    on delete cascade
);

-- Per-user write counter for rate limiting. Not exposed to the API.
create table private.write_budget (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  write_count  integer not null
);

-- Undeleted sessions. The app reads through this view.
create view public.visible_study_sessions
with (security_invoker = true)
as
  select * from public.study_sessions where deleted_at is null;

-- ---------------------------------------------------------------------
-- Rate limiting: at most 60 writes per user per rolling minute,
-- counted across every user-owned table.
-- ---------------------------------------------------------------------

create or replace function private.consume_write_budget()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  -- No user: service role, scheduled jobs, sign-up.
  -- Deletes: users cannot hard-delete; deletes only come from account
  -- deletion cascades and the purge job, which must never be blocked.
  if v_uid is null or tg_op = 'DELETE' then
    return null;
  end if;

  insert into private.write_budget as wb (user_id, window_start, write_count)
  values (v_uid, now(), 1)
  on conflict (user_id) do update
    set write_count  = case when wb.window_start < now() - interval '1 minute'
                            then 1 else wb.write_count + 1 end,
        window_start = case when wb.window_start < now() - interval '1 minute'
                            then now() else wb.window_start end
  returning write_count into v_count;

  if v_count > 60 then
    raise exception 'rate_limited'
      using hint = 'Too many changes in a short time. Wait a minute and try again.';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Subjects: normalization, duplicate handling, limits
-- ---------------------------------------------------------------------

create or replace function private.subjects_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active integer;
  v_total  integer;
begin
  if tg_op = 'UPDATE' then
    new.id      := old.id;
    new.user_id := old.user_id;
  end if;

  new.display_name := private.normalize_subject_name(new.display_name);
  if new.display_name is null or char_length(new.display_name) > 40 then
    raise exception 'subject_name_invalid' using hint = 'Subject names need 1 to 40 characters.';
  end if;

  if tg_op = 'INSERT' or (new.is_active and not old.is_active) then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    select count(*) filter (where is_active), count(*)
      into v_active, v_total
      from public.subjects
     where user_id = new.user_id;

    if new.is_active and v_active >= 100 then
      raise exception 'subject_limit_reached'
        using hint = 'You have 100 subjects. Remove one you no longer use to add another.';
    end if;
    if tg_op = 'INSERT' and v_total >= 500 then
      raise exception 'subject_total_limit_reached'
        using hint = 'You have reached the maximum number of subjects.';
    end if;
  end if;

  return new;
end;
$$;

-- Add a subject from the dropdown. Brings back a removed subject with the
-- same name (using the new capitalization) instead of creating a duplicate.
create or replace function public.add_subject(p_name text)
returns public.subjects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_uid();
  v_name text := private.normalize_subject_name(p_name);
  v_row  public.subjects;
begin
  if v_name is null or char_length(v_name) > 40 then
    raise exception 'subject_name_invalid' using hint = 'Subject names need 1 to 40 characters.';
  end if;

  select * into v_row
    from public.subjects
   where user_id = v_uid and name_key = lower(v_name)
   for update;

  if found then
    if v_row.is_active then
      raise exception 'subject_exists' using hint = 'That subject is already in your list.';
    end if;
    update public.subjects
       set is_active = true, display_name = v_name, last_used_at = now()
     where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  insert into public.subjects (user_id, display_name, last_used_at)
  values (v_uid, v_name, now())
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Study sessions: validation
-- ---------------------------------------------------------------------

create or replace function private.study_sessions_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz        text;
  v_today     date;
  v_active    boolean;
  v_day_total integer;
  v_day_count integer;
begin
  if tg_op = 'UPDATE' then
    new.id      := old.id;
    new.user_id := old.user_id;
    new.source  := old.source;
  end if;

  new.note := nullif(btrim(new.note), '');

  -- A newly chosen subject must be active. Old entries keep a removed subject,
  -- and a stopwatch keeps the subject it started with.
  if (tg_op = 'INSERT' and new.source = 'manual')
     or (tg_op = 'UPDATE' and new.subject_id is distinct from old.subject_id) then
    select is_active into v_active
      from public.subjects
     where id = new.subject_id and user_id = new.user_id;
    if not coalesce(v_active, false) then
      raise exception 'subject_inactive' using hint = 'Pick a subject from your list.';
    end if;
  end if;

  -- No dates in the future, judged in the user's own timezone.
  if tg_op = 'INSERT' or new.session_date is distinct from old.session_date then
    select timezone into v_tz from public.user_settings where user_id = new.user_id;
    v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;
    if new.session_date > v_today then
      raise exception 'session_date_in_future' using hint = 'Sessions cannot be dated in the future.';
    end if;
  end if;

  -- At most 24 hours and 50 sessions on any one day.
  if new.deleted_at is null and (
       tg_op = 'INSERT'
       or old.deleted_at is not null
       or new.session_date <> old.session_date
       or new.duration_minutes <> old.duration_minutes) then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1));
    select coalesce(sum(duration_minutes), 0), count(*)
      into v_day_total, v_day_count
      from public.study_sessions
     where user_id = new.user_id
       and session_date = new.session_date
       and deleted_at is null
       and id <> new.id;

    if v_day_total + new.duration_minutes > 1440 then
      raise exception 'daily_limit_exceeded'
        using hint = 'That would put more than 24 hours on one day.';
    end if;
    if v_day_count >= 50 then
      raise exception 'daily_session_limit'
        using hint = 'You can log up to 50 sessions per day.';
    end if;
  end if;

  return new;
end;
$$;

-- Move the subject to the top of the dropdown.
create or replace function private.study_sessions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subjects
     set last_used_at = now()
   where id = new.subject_id and user_id = new.user_id;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Profiles: usernames
-- Rules: 3-20 characters, lowercase letters, digits and _, starting with a
-- letter. Typed in any case and stored lowercase. Some names are reserved.
-- ---------------------------------------------------------------------

create or replace function private.is_reserved_username(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_username = any (array[
    'admin', 'administrator', 'root', 'system', 'staff', 'mod', 'moderator',
    'support', 'help', 'contact', 'studyott', 'official', 'team',
    'api', 'www', 'mail', 'email', 'app', 'auth', 'login', 'logout', 'signin',
    'signup', 'register', 'settings', 'account', 'profile', 'history',
    'lifetime', 'friends', 'privacy', 'terms', 'about', 'me', 'user', 'users',
    'null', 'undefined', 'anonymous', 'everyone'])
$$;

-- "David Cardoso" -> "david_4821";  no usable name -> "user_4821".
create or replace function private.generate_username(p_hint text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_base      text := left(regexp_replace(lower(coalesce(p_hint, '')), '[^a-z0-9]', '', 'g'), 12);
  v_candidate text;
  v_tries     integer := 0;
begin
  if v_base !~ '^[a-z]' then
    v_base := left('user' || v_base, 12);
  end if;
  loop
    v_candidate := v_base || '_' || lpad(floor(random() * 10000)::integer::text, 4, '0');
    exit when not exists (select 1 from public.profiles where username = v_candidate);
    v_tries := v_tries + 1;
    if v_tries >= 50 then
      v_candidate := 'user_' || left(replace(gen_random_uuid()::text, '-', ''), 12);
      exit;
    end if;
  end loop;
  return v_candidate;
end;
$$;

create or replace function private.profiles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.username_changed_at := old.username_changed_at;
    if auth.uid() is not null then
      new.avatar_url := old.avatar_url;  -- only set from Google, never by users
    end if;
  end if;

  new.username     := lower(btrim(new.username));
  new.display_name := nullif(btrim(new.display_name), '');

  if new.username is null or new.username !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'username_invalid'
      using hint = 'Usernames are 3 to 20 characters: letters, numbers and _, starting with a letter.';
  end if;

  if tg_op = 'INSERT' or new.username <> old.username then
    if private.is_reserved_username(new.username) then
      raise exception 'username_reserved' using hint = 'That username isn''t available.';
    end if;
    if exists (select 1 from public.profiles
                where username = new.username and user_id <> new.user_id) then
      raise exception 'username_taken' using hint = 'That username is taken.';
    end if;
    if tg_op = 'UPDATE' then
      new.username_changed_at := now();
    end if;
  end if;

  return new;
end;
$$;

-- Live check for the username field: 'available' | 'taken' | 'reserved' | 'invalid'.
create or replace function public.username_available(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_uid();
  v_name text := lower(btrim(p_username));
begin
  if v_name is null or v_name !~ '^[a-z][a-z0-9_]{2,19}$' then
    return 'invalid';
  end if;
  if private.is_reserved_username(v_name) then
    return 'reserved';
  end if;
  if exists (select 1 from public.profiles where username = v_name and user_id <> v_uid) then
    return 'taken';
  end if;
  return 'available';
end;
$$;

-- ---------------------------------------------------------------------
-- User settings: validation
-- ---------------------------------------------------------------------

create or replace function private.user_settings_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  if new.timezone is distinct from old.timezone
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'timezone_invalid' using hint = 'Choose a timezone from the list.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- New users: profile (auto username) + settings row + default subjects.
-- The first-visit welcome lets the user confirm or change the username.
-- ---------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := coalesce(new.raw_user_meta_data ->> 'full_name',
                            new.raw_user_meta_data ->> 'name');
  v_avatar text := coalesce(new.raw_user_meta_data ->> 'avatar_url',
                            new.raw_user_meta_data ->> 'picture');
begin
  insert into public.profiles (user_id, username, display_name, avatar_url)
  values (
    new.id,
    private.generate_username(coalesce(split_part(v_name, ' ', 1),
                                       split_part(new.email, '@', 1))),
    left(v_name, 50),
    case when char_length(v_avatar) <= 500 then v_avatar end);

  insert into public.user_settings (user_id) values (new.id);
  insert into public.subjects (user_id, display_name)
  select new.id, s
    from unnest(array['Math', 'Science', 'English', 'History',
                      'Computer Science', 'Languages', 'Other']) as s;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Stopwatch (cross-device). All changes go through these functions.
-- Each returns jsonb: { server_now, timer: {...row, elapsed_seconds} | null [, session] }
-- Clients compute the ticking display from started_at / paused_at /
-- paused_total plus their offset from server_now.
-- Every change except heartbeat requires the caller's current `version`;
-- a mismatch raises 'timer_conflict' (another device changed it) and the
-- client should refetch with timer_get().
-- ---------------------------------------------------------------------

create or replace function private.timer_elapsed(t public.active_timers, p_end timestamptz)
returns interval
language sql
stable
set search_path = ''
as $$
  select least(
           greatest((coalesce(t.paused_at, p_end) - t.started_at) - t.paused_total, interval '0'),
           interval '24 hours')
$$;

create or replace function private.timer_json(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'server_now', now(),
    'timer', (
      select to_jsonb(t) || jsonb_build_object(
               'elapsed_seconds',
               floor(extract(epoch from private.timer_elapsed(t, now())))::integer)
        from public.active_timers t
       where t.user_id = p_uid))
$$;

create or replace function private.lock_timer(p_uid uuid, p_version integer)
returns public.active_timers
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.active_timers;
begin
  select * into t from public.active_timers where user_id = p_uid for update;
  if not found then
    raise exception 'timer_not_found' using hint = 'This timer was already saved or discarded.';
  end if;
  if p_version is distinct from t.version then
    raise exception 'timer_conflict' using hint = 'This timer changed on another device.';
  end if;
  return t;
end;
$$;

create or replace function public.timer_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.timer_json(private.require_uid());
end;
$$;

create or replace function public.timer_start(p_subject_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if not exists (select 1 from public.subjects
                  where id = p_subject_id and user_id = v_uid and is_active) then
    raise exception 'subject_inactive' using hint = 'Pick a subject from your list.';
  end if;

  insert into public.active_timers (user_id, subject_id, note, started_at, last_active_at)
  values (v_uid, p_subject_id, nullif(btrim(p_note), ''), now(), now())
  on conflict (user_id) do nothing;

  if not found then
    raise exception 'timer_already_running' using hint = 'A timer is already running.';
  end if;

  update public.subjects set last_used_at = now() where id = p_subject_id and user_id = v_uid;
  return private.timer_json(v_uid);
end;
$$;

create or replace function public.timer_pause(p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  t     public.active_timers := private.lock_timer(v_uid, p_version);
begin
  if t.paused_at is not null then
    raise exception 'timer_not_running' using hint = 'The timer is already paused.';
  end if;
  update public.active_timers
     set paused_at = now(), last_active_at = now(), version = version + 1
   where user_id = v_uid;
  return private.timer_json(v_uid);
end;
$$;

create or replace function public.timer_resume(p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  t     public.active_timers := private.lock_timer(v_uid, p_version);
begin
  if t.paused_at is null then
    raise exception 'timer_not_paused' using hint = 'The timer is already running.';
  end if;
  if private.timer_elapsed(t, now()) >= interval '24 hours' then
    raise exception 'timer_max_reached' using hint = 'Sessions can be at most 24 hours. Save or discard this one.';
  end if;
  update public.active_timers
     set paused_total   = paused_total + (now() - paused_at),
         paused_at      = null,
         last_active_at = now(),
         version        = version + 1
   where user_id = v_uid;
  return private.timer_json(v_uid);
end;
$$;

-- Subject and note can change only while paused (matches the requirements).
create or replace function public.timer_update_details(
  p_version integer, p_subject_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  t     public.active_timers := private.lock_timer(v_uid, p_version);
begin
  if t.paused_at is null then
    raise exception 'timer_not_paused' using hint = 'Pause the timer to edit it.';
  end if;
  if p_subject_id is distinct from t.subject_id
     and not exists (select 1 from public.subjects
                      where id = p_subject_id and user_id = v_uid and is_active) then
    raise exception 'subject_inactive' using hint = 'Pick a subject from your list.';
  end if;
  update public.active_timers
     set subject_id = p_subject_id,
         note       = nullif(btrim(p_note), ''),
         version    = version + 1
   where user_id = v_uid;
  return private.timer_json(v_uid);
end;
$$;

-- Called every few minutes while a device has StudyOtt open and visible.
-- Clients must call timer_get() and check for the Welcome Back prompt
-- BEFORE sending heartbeats again after returning.
create or replace function public.timer_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  update public.active_timers
     set last_active_at = now()
   where user_id = v_uid and paused_at is null;
  return private.timer_json(v_uid);
end;
$$;

-- Save the timer as a study session.
--   p_end = 'now'          normal save
--   p_end = 'last_active'  Welcome Back: "stop when I was last here"
--   p_duration_minutes     Welcome Back: "edit the time, then save"
create or replace function public.timer_save(
  p_version integer,
  p_end text default 'now',
  p_duration_minutes integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.require_uid();
  t         public.active_timers := private.lock_timer(v_uid, p_version);
  v_end     timestamptz;
  v_minutes integer;
  v_tz      text;
  v_local   timestamp;
  v_session public.study_sessions;
begin
  if p_end not in ('now', 'last_active') then
    raise exception 'invalid_argument' using hint = 'Unknown end option.';
  end if;
  v_end := case when p_end = 'last_active' then t.last_active_at else now() end;

  v_minutes := coalesce(
    p_duration_minutes,
    round(extract(epoch from private.timer_elapsed(t, v_end)) / 60.0)::integer);
  if v_minutes < 1 then
    raise exception 'session_too_short' using hint = 'Sessions need at least 1 minute.';
  end if;
  if v_minutes > 1440 then
    raise exception 'duration_invalid' using hint = 'Sessions can be at most 24 hours.';
  end if;

  select timezone into v_tz from public.user_settings where user_id = v_uid;
  v_local := t.started_at at time zone coalesce(v_tz, 'UTC');

  insert into public.study_sessions
    (user_id, subject_id, duration_minutes, session_date, session_time, note, source)
  values
    (v_uid, t.subject_id, v_minutes, v_local::date,
     date_trunc('minute', v_local)::time, t.note, 'stopwatch')
  returning * into v_session;

  delete from public.active_timers where user_id = v_uid;

  return private.timer_json(v_uid) || jsonb_build_object('session', to_jsonb(v_session));
end;
$$;

create or replace function public.timer_discard(p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  t     public.active_timers := private.lock_timer(v_uid, p_version);
begin
  delete from public.active_timers where user_id = v_uid;
  return private.timer_json(v_uid);
end;
$$;

-- ---------------------------------------------------------------------
-- Soft-delete purge. Phase 8 schedules it nightly with pg_cron:
--   select cron.schedule('purge-deleted-sessions', '15 10 * * *',
--                        'select private.purge_deleted_sessions()');
-- ---------------------------------------------------------------------

create or replace function private.purge_deleted_sessions()
returns integer
language sql
security definer
set search_path = ''
as $$
  with d as (
    delete from public.study_sessions
     where deleted_at < now() - interval '30 days'
    returning 1)
  select count(*)::integer from d
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

create trigger subjects_timestamps before insert or update on public.subjects
  for each row execute function private.set_timestamps();
create trigger subjects_validate before insert or update on public.subjects
  for each row execute function private.subjects_before_write();
create trigger subjects_budget after insert or update or delete on public.subjects
  for each row execute function private.consume_write_budget();

create trigger study_sessions_timestamps before insert or update on public.study_sessions
  for each row execute function private.set_timestamps();
create trigger study_sessions_validate before insert or update on public.study_sessions
  for each row execute function private.study_sessions_before_write();
create trigger study_sessions_mark_used after insert on public.study_sessions
  for each row execute function private.study_sessions_after_insert();
create trigger study_sessions_budget after insert or update or delete on public.study_sessions
  for each row execute function private.consume_write_budget();

create trigger profiles_timestamps before insert or update on public.profiles
  for each row execute function private.set_timestamps();
create trigger profiles_validate before insert or update on public.profiles
  for each row execute function private.profiles_before_write();
create trigger profiles_budget after insert or update or delete on public.profiles
  for each row execute function private.consume_write_budget();

create trigger user_settings_timestamps before insert or update on public.user_settings
  for each row execute function private.set_timestamps();
create trigger user_settings_validate before update on public.user_settings
  for each row execute function private.user_settings_before_update();
create trigger user_settings_budget after insert or update or delete on public.user_settings
  for each row execute function private.consume_write_budget();

create trigger active_timers_timestamps before insert or update on public.active_timers
  for each row execute function private.set_timestamps();
create trigger active_timers_budget after insert or update or delete on public.active_timers
  for each row execute function private.consume_write_budget();

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- Row Level Security and privileges
-- ---------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.subjects       enable row level security;
alter table public.user_settings  enable row level security;
alter table public.study_sessions enable row level security;
alter table public.active_timers  enable row level security;
alter table private.write_budget  enable row level security;  -- no policies: no API access

-- Own profile only for now. The friends feature will add a policy letting
-- friends (and username search) see username, display_name and avatar.
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy subjects_select_own on public.subjects
  for select to authenticated using (user_id = (select auth.uid()));
create policy subjects_insert_own on public.subjects
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy subjects_update_own on public.subjects
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy study_sessions_select_own on public.study_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy study_sessions_insert_own on public.study_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy study_sessions_update_own on public.study_sessions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_settings_update_own on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy active_timers_select_own on public.active_timers
  for select to authenticated using (user_id = (select auth.uid()));

-- Table privileges: no DELETE for users anywhere (soft delete only);
-- timers are read-only outside the timer_* functions.
revoke all on public.profiles, public.subjects, public.user_settings, public.study_sessions,
              public.active_timers, public.visible_study_sessions
  from anon, authenticated;
grant select, update         on public.profiles       to authenticated;
grant select, insert, update on public.subjects       to authenticated;
grant select, insert, update on public.study_sessions to authenticated;
grant select, update         on public.user_settings  to authenticated;
grant select                 on public.active_timers  to authenticated;
grant select                 on public.visible_study_sessions to authenticated;

-- Function privileges: only signed-in users may call the API functions.
revoke all on all functions in schema private from public, anon, authenticated;

revoke all on function public.username_available(text) from public, anon;
revoke all on function public.add_subject(text) from public, anon;
revoke all on function public.timer_get() from public, anon;
revoke all on function public.timer_start(uuid, text) from public, anon;
revoke all on function public.timer_pause(integer) from public, anon;
revoke all on function public.timer_resume(integer) from public, anon;
revoke all on function public.timer_update_details(integer, uuid, text) from public, anon;
revoke all on function public.timer_heartbeat() from public, anon;
revoke all on function public.timer_save(integer, text, integer) from public, anon;
revoke all on function public.timer_discard(integer) from public, anon;

grant execute on function public.username_available(text) to authenticated;
grant execute on function public.add_subject(text) to authenticated;
grant execute on function public.timer_get() to authenticated;
grant execute on function public.timer_start(uuid, text) to authenticated;
grant execute on function public.timer_pause(integer) to authenticated;
grant execute on function public.timer_resume(integer) to authenticated;
grant execute on function public.timer_update_details(integer, uuid, text) to authenticated;
grant execute on function public.timer_heartbeat() to authenticated;
grant execute on function public.timer_save(integer, text, integer) to authenticated;
grant execute on function public.timer_discard(integer) to authenticated;
