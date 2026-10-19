-- Stopwatch: timer_* functions, cross-device versioning, Welcome Back save
-- options, the 24-hour cap, and sessions that cross midnight.
-- The test "moves the clock" by editing active_timers as admin, since now()
-- is fixed for the whole transaction.
begin;
\ir helpers.psql
select plan(19);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'a@x.com',
                         '{"full_name": "David Cardoso"}');

-- Calls a timer function and keeps its jsonb result for the checks after it.
create function tests.timer(p_call text)
returns jsonb
language plpgsql
as $$
declare
  v jsonb;
begin
  execute 'select ' || p_call into v;
  perform tests.remember('timer', v::text);
  return v;
end;
$$;
grant execute on function tests.timer(text) to authenticated;

create function tests.last()
returns jsonb
language sql
stable
as $$
  select tests.recall('timer')::jsonb;
$$;
grant execute on function tests.last() to authenticated;

select tests.as_user('11111111-1111-1111-1111-111111111111');
select tests.remember('math', (select id::text from public.subjects where name_key = 'math'));
update public.user_settings set timezone = 'America/Los_Angeles';

select throws_ok(
  format($$insert into public.active_timers (user_id, subject_id, started_at, last_active_at)
           values (%L, %L, now(), now())$$,
         '11111111-1111-1111-1111-111111111111', tests.recall('math')),
  '42501', 'permission denied for table active_timers',
  'timer table cannot be written directly');

select tests.timer(format('public.timer_start(%L, %L)', tests.recall('math'), 'ch 4'));
select ok(tests.last() -> 'timer' ->> 'version' = '1'
          and tests.last() -> 'timer' -> 'paused_at' = 'null'::jsonb
          and tests.last() ? 'server_now',
  'timer started (version 1, running, with server_now)');

select throws_ok(
  format('select public.timer_start(%L)', tests.recall('math')),
  'P0001', 'timer_already_running',
  'second timer refused (one per user, shared across devices)');

-- 60 minutes ago, last seen 5 minutes ago; then 10 minutes paused.
select tests.as_admin();
update public.active_timers
   set started_at = now() - interval '60 minutes', last_active_at = now() - interval '5 minutes';
select tests.as_user('11111111-1111-1111-1111-111111111111');

select tests.timer('public.timer_pause(1)');
select ok(tests.last() -> 'timer' ->> 'version' = '2'
          and tests.last() -> 'timer' ->> 'paused_at' is not null,
  'paused (version 2)');

select throws_ok('select public.timer_resume(1)', 'P0001', 'timer_conflict',
  'stale version from another device -> timer_conflict');

select tests.as_admin();
update public.active_timers set paused_at = now() - interval '10 minutes';
select tests.as_user('11111111-1111-1111-1111-111111111111');

select tests.timer('public.timer_resume(2)');
select ok(tests.last() -> 'timer' ->> 'version' = '3'
          and (tests.last() -> 'timer' ->> 'elapsed_seconds')::int = 50 * 60,
  'resumed; elapsed = 50 min (60 - 10 paused)');

select throws_ok(
  format($$select public.timer_update_details(3, %L, 'x')$$, tests.recall('math')),
  'P0001', 'timer_not_paused',
  'cannot edit details while running');

select tests.timer('public.timer_save(3)');
select ok(tests.last() -> 'timer' = 'null'::jsonb
          and (tests.last() -> 'session' ->> 'duration_minutes')::int = 50
          and tests.last() -> 'session' ->> 'source' = 'stopwatch'
          and tests.last() -> 'session' ->> 'note' = 'ch 4',
  'saved as a 50-minute stopwatch session with its note');

select is(
  (select count(*)::int from public.visible_study_sessions where source = 'stopwatch'),
  1,
  'the saved session is in the session list');

-- Welcome Back: "stop when I was last here".
select public.timer_start(tests.recall('math')::uuid);
select tests.as_admin();
update public.active_timers
   set started_at = now() - interval '3 hours', last_active_at = now() - interval '2 hours';
select tests.as_user('11111111-1111-1111-1111-111111111111');

select tests.timer($$public.timer_save(1, 'last_active')$$);
select is((tests.last() -> 'session' ->> 'duration_minutes')::int, 60,
  'Welcome Back "stop when I was last here" saves 60 min, not 3h');

-- Welcome Back: "edit the time, then save".
select public.timer_start(tests.recall('math')::uuid);
select tests.timer($$public.timer_save(1, 'now', 25)$$);
select is((tests.last() -> 'session' ->> 'duration_minutes')::int, 25,
  'Welcome Back "edit the time" saves the chosen minutes');

-- Too short, then discard.
select public.timer_start(tests.recall('math')::uuid);
select throws_ok('select public.timer_save(1)', 'P0001', 'session_too_short',
  'under 30 seconds -> session_too_short');

select public.timer_discard(1);
select ok(public.timer_get() -> 'timer' = 'null'::jsonb, 'discard removes the timer');
select throws_ok('select public.timer_pause(1)', 'P0001', 'timer_not_found',
  'changing a discarded timer -> timer_not_found');

-- 24-hour cap.
select public.timer_start(tests.recall('math')::uuid);
select tests.as_admin();
update public.active_timers set started_at = now() - interval '30 hours';
select tests.as_user('11111111-1111-1111-1111-111111111111');

select is((public.timer_get() -> 'timer' ->> 'elapsed_seconds')::int, 86400,
  'elapsed caps at 24 hours');

select public.timer_pause(1);
select throws_ok('select public.timer_resume(2)', 'P0001', 'timer_max_reached',
  'cannot resume a timer at 24 hours');
select public.timer_discard(2);

-- Heartbeat updates last_active_at.
select public.timer_start(tests.recall('math')::uuid);
select tests.as_admin();
update public.active_timers set last_active_at = now() - interval '7 minutes';
select tests.as_user('11111111-1111-1111-1111-111111111111');

select ok((public.timer_heartbeat() -> 'timer' ->> 'last_active_at')::timestamptz = now(),
  'heartbeat refreshes last_active_at');
select public.timer_discard(1);

-- Started 23:30 Los Angeles time yesterday: dated yesterday, not today.
select public.timer_start(tests.recall('math')::uuid);
select tests.as_admin();
update public.active_timers
   set started_at = ((now() at time zone 'America/Los_Angeles')::date - 1 + time '23:30')
                    at time zone 'America/Los_Angeles';
select tests.as_user('11111111-1111-1111-1111-111111111111');

select tests.timer($$public.timer_save(1, 'now', 60)$$);
select results_eq(
  $$select tests.last() -> 'session' ->> 'session_date', tests.last() -> 'session' ->> 'session_time'$$,
  format($$values (%L, '23:30:00')$$, (now() at time zone 'America/Los_Angeles')::date - 1),
  'a session past midnight counts on the day it started');

select tests.as_user(null);
select throws_ok('select public.timer_get()', 'P0001', 'not_authenticated',
  'a request with no user -> not_authenticated');

select * from finish();
rollback;
