-- Profiles: auto-generated usernames, username rules, availability check,
-- and the Google avatar users can't change.
begin;
\ir helpers.psql
select plan(11);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'a@x.com',
  '{"full_name": "David Cardoso", "avatar_url": "https://lh3.googleusercontent.com/a/x"}');
select tests.create_user('22222222-2222-2222-2222-222222222222', '7up@x.com');

select tests.as_user('11111111-1111-1111-1111-111111111111');

select ok(
  (select count(*) = 1 and bool_and(username ~ '^david_\d{4}$' and display_name = 'David Cardoso')
     from public.profiles),
  'auto username from Google name (david_NNNN) and display name');

select tests.as_user('22222222-2222-2222-2222-222222222222');

select matches(
  (select username from public.profiles),
  '^user7up_\d{4}$',
  'name starting with a digit gets a "user" prefix');

select tests.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$update public.profiles set username = 'David.C'$$,
  'P0001', 'username_invalid',
  'username with a dot rejected');

select throws_ok(
  $$update public.profiles set username = 'ab'$$,
  'P0001', 'username_invalid',
  'too-short username rejected');

select throws_ok(
  $$update public.profiles set username = 'Admin'$$,
  'P0001', 'username_reserved',
  'reserved username rejected');

update public.profiles set username = '  DavidC ';

select results_eq(
  'select username, username_changed_at is not null from public.profiles',
  $$values ('davidc', true)$$,
  'username saved lowercase, change time recorded');

select tests.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$update public.profiles set username = 'DAVIDC'$$,
  'P0001', 'username_taken',
  'username uniqueness ignores case');

select is(
  array[public.username_available('davidc'), public.username_available('support'),
        public.username_available('9lives'), public.username_available('freebird')],
  array['taken', 'reserved', 'invalid', 'available'],
  'username_available: taken / reserved / invalid / available');

select tests.as_user('11111111-1111-1111-1111-111111111111');

update public.profiles set avatar_url = 'https://evil.example/pixel.gif';

select is(
  (select avatar_url from public.profiles),
  'https://lh3.googleusercontent.com/a/x',
  'users cannot change avatar_url');

select is(
  public.username_available('davidc'),
  'available',
  'your own username shows as available to you');

select tests.as_anon();

select throws_ok(
  $$select public.username_available('freebird')$$,
  '42501', 'permission denied for function username_available',
  'signed-out visitors cannot check usernames');

select * from finish();
rollback;
