-- Row Level Security: users only ever see and change their own rows, nobody
-- hard-deletes, and signed-out visitors get nothing.
begin;
\ir helpers.psql
select plan(17);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'a@x.com',
                         '{"full_name": "David Cardoso"}');
select tests.create_user('22222222-2222-2222-2222-222222222222', '7up@x.com');

select tests.remember('a_math', (select id::text from public.subjects
  where user_id = '11111111-1111-1111-1111-111111111111' and name_key = 'math'));

-- A has a session and a running timer.
select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.study_sessions (subject_id, duration_minutes, session_date)
values (tests.recall('a_math')::uuid, 45, current_date - 1);
select tests.remember('a_session', (select id::text from public.study_sessions));
select public.timer_start(tests.recall('a_math')::uuid);

select tests.as_user('22222222-2222-2222-2222-222222222222');

select is((select count(*)::int from public.profiles), 1,
  'B sees only their own profile (until friends exist)');
select is((select count(*)::int from public.subjects), 7,
  'B sees only their own 7 subjects');
select is((select count(*)::int from public.user_settings), 1,
  'B sees only their own settings');
select is((select count(*)::int from public.study_sessions), 0,
  'B sees none of A''s sessions');
select is((select count(*)::int from public.visible_study_sessions), 0,
  'B sees none of A''s sessions through the view');
select is((select count(*)::int from public.active_timers), 0,
  'B cannot read A''s timer row');
select ok((select public.timer_get() -> 'timer' = 'null'::jsonb),
  'timer_get shows B no timer');

select throws_ok(
  format($$insert into public.study_sessions (subject_id, duration_minutes, session_date)
           values (%L, 30, current_date - 1)$$, tests.recall('a_math')),
  'P0001', 'subject_inactive',
  'B cannot log a session on A''s subject');

select throws_ok(
  format($$insert into public.subjects (user_id, display_name) values (%L, 'Sneaky')$$,
         '11111111-1111-1111-1111-111111111111'),
  '42501', 'new row violates row-level security policy for table "subjects"',
  'B cannot add a subject to A''s list');

update public.subjects set display_name = 'hacked' where id = tests.recall('a_math')::uuid;
update public.study_sessions set deleted_at = now() where id = tests.recall('a_session')::uuid;
update public.profiles set display_name = 'hacked'
 where user_id = '11111111-1111-1111-1111-111111111111';
update public.user_settings set theme_mode = 'dark'
 where user_id = '11111111-1111-1111-1111-111111111111';

select tests.as_admin();

select is((select display_name from public.subjects where id = tests.recall('a_math')::uuid),
  'Math', 'B cannot rename A''s subject');
select ok((select deleted_at is null from public.study_sessions
            where id = tests.recall('a_session')::uuid),
  'B cannot delete A''s session');
select ok((select p.display_name = 'David Cardoso' and s.theme_mode = 'system'
             from public.profiles p join public.user_settings s using (user_id)
            where user_id = '11111111-1111-1111-1111-111111111111'),
  'B cannot change A''s profile or settings');

select tests.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  format('delete from public.subjects where id = %L', tests.recall('a_math')),
  '42501', 'permission denied for table subjects',
  'hard delete of subjects is denied');
select throws_ok(
  format('delete from public.study_sessions where id = %L', tests.recall('a_session')),
  '42501', 'permission denied for table study_sessions',
  'hard delete of sessions is denied');

select tests.as_anon();

select throws_ok('select * from public.subjects',
  '42501', 'permission denied for table subjects',
  'anon cannot read subjects');
select throws_ok('select * from public.visible_study_sessions',
  '42501', 'permission denied for view visible_study_sessions',
  'anon cannot read sessions');
select throws_ok('select public.timer_get()',
  '42501', 'permission denied for function timer_get',
  'anon cannot call timer_get');

select * from finish();
rollback;
