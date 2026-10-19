-- Account deletion removes everything, and the nightly purge removes only
-- sessions deleted more than 30 days ago.
begin;
\ir helpers.psql
select plan(4);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'a@x.com',
                         '{"full_name": "David Cardoso"}');
select tests.create_user('22222222-2222-2222-2222-222222222222', '7up@x.com');

-- A has sessions, a timer and a write budget row.
select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.study_sessions (subject_id, duration_minutes, session_date)
select id, 30, current_date - 1 from public.subjects where name_key = 'math';
select public.timer_start((select id from public.subjects where name_key = 'math'));
select tests.as_admin();

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select (select count(*) from public.subjects where user_id = u.id)
        + (select count(*) from public.study_sessions where user_id = u.id)
        + (select count(*) from public.user_settings where user_id = u.id)
        + (select count(*) from public.profiles where user_id = u.id)
        + (select count(*) from public.active_timers where user_id = u.id)
        + (select count(*) from private.write_budget where user_id = u.id)
     from (values ('11111111-1111-1111-1111-111111111111'::uuid)) as u (id))::int,
  0,
  'deleting the account removes all of its data');

-- B: one session deleted 31 days ago, one deleted yesterday, one kept.
insert into public.study_sessions (user_id, subject_id, duration_minutes, session_date, note, deleted_at)
select '22222222-2222-2222-2222-222222222222', id, 30, current_date - 40, v.note, v.deleted_at
  from public.subjects
 cross join (values ('old', now() - interval '31 days'),
                    ('recent', now() - interval '1 day'),
                    ('kept', null::timestamptz)) as v (note, deleted_at)
 where user_id = '22222222-2222-2222-2222-222222222222' and name_key = 'math';

select cmp_ok(private.purge_deleted_sessions(), '>=', 1, 'purge job runs');
select is(
  (select array_agg(note order by note) from public.study_sessions
    where user_id = '22222222-2222-2222-2222-222222222222'),
  array['kept', 'recent'],
  'purge removes sessions deleted over 30 days ago and keeps the rest');

select ok(
  not has_function_privilege('authenticated', 'private.purge_deleted_sessions()', 'execute'),
  'signed-in users cannot run the purge');

select * from finish();
rollback;
