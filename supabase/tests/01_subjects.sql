-- Subjects: defaults for new users, add_subject normalization, duplicates,
-- reactivation, and most-recently-used dropdown order.
begin;
\ir helpers.psql
select plan(11);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'a@x.com',
                         '{"full_name": "David Cardoso"}');
select tests.create_user('22222222-2222-2222-2222-222222222222', '7up@x.com');

-- Every subject's last_used_at moves back by p_age, so the next "use" is
-- clearly newer. (now() is fixed for the whole transaction.)
create function tests.age_subjects(p_age interval)
returns void
language sql
as $$
  update public.subjects set last_used_at = last_used_at - p_age where last_used_at is not null;
$$;

select tests.as_user('11111111-1111-1111-1111-111111111111');

select is(
  (select array_agg(display_name order by display_name) from public.subjects),
  array['Computer Science', 'English', 'History', 'Languages', 'Math', 'Other', 'Science'],
  'new user gets 7 default subjects');

select results_eq(
  'select week_start from public.user_settings',
  $$values (1::smallint)$$,
  'settings row created, week starts Monday');

select is(
  (select display_name from public.add_subject('  linear   algebra ')),
  'Linear Algebra',
  'normalizes "  linear   algebra " to "Linear Algebra"');

select tests.as_admin();
select tests.age_subjects('1 minute');
select tests.as_user('11111111-1111-1111-1111-111111111111');

select is(
  (select display_name from public.add_subject('AP bio')),
  'AP Bio',
  'keeps acronyms: "AP bio" -> "AP Bio"');

select throws_ok(
  $$select public.add_subject('LINEAR algebra')$$,
  'P0001', 'subject_exists',
  'duplicate (case-insensitive) -> subject_exists');

select throws_ok(
  $$select public.add_subject('   ')$$,
  'P0001', 'subject_name_invalid',
  'blank name rejected');

update public.subjects set is_active = false where name_key = 'linear algebra';

select tests.as_admin();
select tests.age_subjects('1 minute');
select tests.as_user('11111111-1111-1111-1111-111111111111');

select results_eq(
  $$select is_active, display_name from public.add_subject('linear Algebra')$$,
  $$values (true, 'Linear Algebra')$$,
  're-adding a removed subject reactivates it');

select is(
  (select count(*)::int from public.subjects where name_key = 'linear algebra'),
  1,
  'no duplicate row created');

select tests.as_admin();
select tests.age_subjects('1 minute');
select tests.as_user('11111111-1111-1111-1111-111111111111');

insert into public.study_sessions (subject_id, duration_minutes, session_date)
select id, 30, current_date - 1 from public.subjects where name_key = 'math';

select is(
  (select array_agg(display_name) from (
     select display_name from public.subjects where is_active
      order by last_used_at desc nulls last, display_name limit 3) s),
  array['Math', 'Linear Algebra', 'AP Bio'],
  'dropdown is most-recently-used first');

select tests.as_user('22222222-2222-2222-2222-222222222222');

select is(
  (select display_name from public.subjects where is_active
    order by last_used_at desc nulls last, display_name limit 1),
  'Computer Science',
  'never-used subjects fall back to A-Z');

select throws_ok(
  $$select public.add_subject(repeat('x', 41))$$,
  'P0001', 'subject_name_invalid',
  'name over 40 characters rejected');

select * from finish();
rollback;
