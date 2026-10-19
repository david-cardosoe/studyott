-- Study sessions: validation, daily limits, removed subjects, soft delete,
-- and timezone checks on settings.
begin;
\ir helpers.psql
select plan(13);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'a@x.com',
                         '{"full_name": "David Cardoso"}');

select tests.as_user('11111111-1111-1111-1111-111111111111');

select tests.remember('math', (select id::text from public.subjects where name_key = 'math'));
select tests.remember('hist', (select id::text from public.subjects where name_key = 'history'));

update public.user_settings set timezone = 'America/Los_Angeles', onboarded_at = now();

select throws_ok(
  $$update public.user_settings set timezone = 'Mars/Base'$$,
  'P0001', 'timezone_invalid',
  'invalid timezone rejected');

insert into public.study_sessions (subject_id, duration_minutes, session_date, note)
values (tests.recall('math')::uuid, 90, current_date - 1, '  chapter 3  ');
select tests.remember('s1', (select id::text from public.study_sessions));

select results_eq(
  'select note, source from public.study_sessions',
  $$values ('chapter 3', 'manual')$$,
  'manual entry saved, note trimmed');

select throws_ok(
  format($$insert into public.study_sessions (subject_id, duration_minutes, session_date)
           values (%L, 30, current_date + 3)$$, tests.recall('math')),
  'P0001', 'session_date_in_future',
  'future date rejected');

select throws_ok(
  format($$insert into public.study_sessions (subject_id, duration_minutes, session_date, note)
           values (%L, 30, current_date - 1, repeat('x', 501))$$, tests.recall('math')),
  '23514', null,
  'note over 500 characters rejected');

select throws_ok(
  format($$insert into public.study_sessions (subject_id, duration_minutes, session_date)
           values (%L, 0, current_date - 1)$$, tests.recall('math')),
  '23514', null,
  '0-minute entry rejected');

select throws_ok(
  format($$insert into public.study_sessions (subject_id, duration_minutes, session_date)
           values (%L, 1400, current_date - 1)$$, tests.recall('math')),
  'P0001', 'daily_limit_exceeded',
  'more than 24 hours on one day rejected');

select throws_ok(
  format($$insert into public.study_sessions (subject_id, duration_minutes, session_date)
           values (%L, 30, date '1999-12-31')$$, tests.recall('math')),
  '23514', null,
  'dates before 2000-01-01 rejected');

-- Removed subjects can't be used on new entries...
update public.subjects set is_active = false where id = tests.recall('hist')::uuid;

select throws_ok(
  format($$insert into public.study_sessions (subject_id, duration_minutes, session_date)
           values (%L, 30, current_date - 2)$$, tests.recall('hist')),
  'P0001', 'subject_inactive',
  'removed subject cannot be used on new entries');

-- ...but old entries on them stay editable.
update public.subjects set is_active = true where id = tests.recall('hist')::uuid;
insert into public.study_sessions (subject_id, duration_minutes, session_date)
values (tests.recall('hist')::uuid, 30, current_date - 2);
select tests.remember('s2', (select id::text from public.study_sessions
                              where subject_id = tests.recall('hist')::uuid));
update public.subjects set is_active = false where id = tests.recall('hist')::uuid;
update public.study_sessions set duration_minutes = 45 where id = tests.recall('s2')::uuid;

select is(
  (select duration_minutes from public.study_sessions where id = tests.recall('s2')::uuid),
  45,
  'old entry on a removed subject can still be edited');

-- Soft delete and Undo.
update public.study_sessions set deleted_at = now() where id = tests.recall('s1')::uuid;

select is((select count(*)::int from public.visible_study_sessions), 1,
  'soft-deleted session hidden from the visible view');

update public.study_sessions set deleted_at = null where id = tests.recall('s1')::uuid;

select is((select count(*)::int from public.visible_study_sessions), 2,
  'undo restores it');

select throws_ok(
  format('delete from public.study_sessions where id = %L', tests.recall('s1')),
  '42501', 'permission denied for table study_sessions',
  'hard delete of sessions denied');

-- 50 sessions a day at most. (Filled as admin so the rate limit doesn't trip.)
select tests.as_admin();
insert into public.study_sessions (user_id, subject_id, duration_minutes, session_date)
select '11111111-1111-1111-1111-111111111111', tests.recall('math')::uuid, 1, current_date - 5
  from generate_series(1, 50);
select tests.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  format($$insert into public.study_sessions (subject_id, duration_minutes, session_date)
           values (%L, 1, current_date - 5)$$, tests.recall('math')),
  'P0001', 'daily_session_limit',
  '51st session on one day rejected');

select * from finish();
rollback;
