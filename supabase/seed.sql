-- =====================================================================
-- Local development and test data. Loaded by `pnpm db:reset`.
-- LOCAL ONLY: never run this against production.
--
-- Two email/password users. The password is TEST_USER_PASSWORD in
-- .env.example (a local-only value, safe to commit):
--   test1@studyott.local  @test1  four weeks of sessions, a removed subject
--                                 with history, one recently deleted session
--   test2@studyott.local  @test2  one week of sessions
-- Both are marked onboarded so tests skip the Welcome page.
-- =====================================================================

-- Auth users. The on_auth_user_created trigger creates each profile,
-- settings row and the 7 default subjects.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, reauthentication_token)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('studyott-local-pw', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', '', '', ''
from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'test1@studyott.local', 'Test One'),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'test2@studyott.local', 'Test Two')
) as u (id, email, full_name);

insert into auth.identities (user_id, provider_id, provider, identity_data,
                             last_sign_in_at, created_at, updated_at)
select id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       now(), now(), now()
  from auth.users
 where email like '%@studyott.local';

-- Fixed usernames, timezones, and skip the Welcome page.
update public.profiles p
   set username = split_part(u.email, '@', 1)
  from auth.users u
 where u.id = p.user_id and u.email like '%@studyott.local';

update public.user_settings
   set timezone = case user_id
                    when '00000000-0000-4000-a000-000000000001' then 'America/New_York'
                    else 'America/Los_Angeles'
                  end,
       onboarded_at = now()
 where user_id in ('00000000-0000-4000-a000-000000000001',
                   '00000000-0000-4000-a000-000000000002');

-- test1 has one extra subject of their own.
insert into public.subjects (user_id, display_name)
values ('00000000-0000-4000-a000-000000000001', 'linear algebra');

-- Sample sessions: 0-3 per day going back `days` days (one rest day a week),
-- with varied subjects, lengths, times, sources and notes. Deterministic, so
-- every reset gives the same data relative to today.
insert into public.study_sessions
  (user_id, subject_id, duration_minutes, session_date, session_time, note, source)
select
  p.user_id,
  sub.id,
  20 + (d * 37 + k * 53) % 101,
  (now() at time zone us.timezone)::date - d,
  -- today's entry has no time, so it never shows a time later than now
  case when d > 0 then
    time '07:30' + (k - 1) * interval '4 hours' + (d % 4) * interval '15 minutes' end,
  case when (d + k) % 4 = 0 then (array['Chapter review', 'Practice problems',
                                        'Flashcards', 'Homework set'])[(d % 4) + 1] end,
  case when k % 2 = 0 then 'stopwatch' else 'manual' end
from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 27,
   array['math', 'science', 'english', 'history', 'computer science', 'linear algebra']),
  ('00000000-0000-4000-a000-000000000002'::uuid, 6,
   array['languages', 'math', 'other'])
) as p (user_id, days, subject_keys)
join public.user_settings us on us.user_id = p.user_id
cross join lateral generate_series(0, p.days) as d
cross join lateral generate_series(1, case when d = 0 then 1 else 1 + d % 3 end) as k
join public.subjects sub
  on sub.user_id = p.user_id
 and sub.name_key = p.subject_keys[(d + k) % cardinality(p.subject_keys) + 1]
where d % 7 <> 5;

-- Dropdown order should reflect when each subject was last studied
-- (inserting the rows above stamped them all with the same now()).
update public.subjects sub
   set last_used_at = x.last_used_at
  from (select s.subject_id,
               max((s.session_date + coalesce(s.session_time, time '12:00'))
                   at time zone us.timezone) as last_used_at
          from public.study_sessions s
          join public.user_settings us on us.user_id = s.user_id
         group by s.subject_id) as x
 where x.subject_id = sub.id;

-- test1 removed History after studying it (shows as "removed" in totals).
update public.subjects
   set is_active = false
 where user_id = '00000000-0000-4000-a000-000000000001' and name_key = 'history';

-- One session test1 deleted two days ago (Settings -> Recently deleted).
update public.study_sessions
   set deleted_at = now() - interval '2 days'
 where id = (select id from public.study_sessions
              where user_id = '00000000-0000-4000-a000-000000000001'
              order by session_date desc, session_time desc
              offset 2 limit 1);
