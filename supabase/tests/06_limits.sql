-- Limits: 100 active subjects, 500 subjects in total, and 60 writes per
-- user per rolling minute.
begin;
\ir helpers.psql
select plan(6);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'a@x.com',
                         '{"full_name": "David Cardoso"}');
select tests.create_user('22222222-2222-2222-2222-222222222222', '7up@x.com');

-- B: 7 defaults + 91 more = 98 active subjects.
insert into public.subjects (user_id, display_name)
select '22222222-2222-2222-2222-222222222222', 'Topic ' || i from generate_series(1, 91) as i;

select tests.as_user('22222222-2222-2222-2222-222222222222');

select is((select count(*) filter (where is_active)::int from public.subjects), 98,
  'B has 98 active subjects');

select public.add_subject('Ninety Nine');
select lives_ok($$select public.add_subject('One Hundred')$$,
  'the 100th subject can be added');

select throws_ok($$select public.add_subject('One Oh One')$$,
  'P0001', 'subject_limit_reached',
  '101st active subject -> subject_limit_reached');

-- Removing one frees a slot; restoring past 100 is refused too.
update public.subjects set is_active = false where name_key = 'topic 1';
select lives_ok($$select public.add_subject('One Oh One')$$,
  'removing a subject frees a slot');
select throws_ok($$update public.subjects set is_active = true where name_key = 'topic 1'$$,
  'P0001', 'subject_limit_reached',
  'restoring a subject past 100 -> subject_limit_reached');

-- A: 60 writes in a minute are fine, the 61st is refused.
select tests.as_admin();
delete from private.write_budget;
select tests.as_user('11111111-1111-1111-1111-111111111111');

do $$
begin
  for i in 1..60 loop
    update public.user_settings set theme_mode = case when i % 2 = 0 then 'dark' else 'light' end;
  end loop;
end;
$$;

select throws_ok($$update public.user_settings set theme_mode = 'system'$$,
  'P0001', 'rate_limited',
  'write 61 within a minute -> rate_limited');

select * from finish();
rollback;
