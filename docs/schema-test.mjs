// Reference checks for docs/schema.sql, run against PGlite (in-memory Postgres).
// Phase 1 ports these to pgTAP tests under supabase/tests/.
// Run: npm i @electric-sql/pglite && node docs/schema-test.mjs docs/schema.sql

import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const db = new PGlite();
const schema = fs.readFileSync(process.argv[2], 'utf8');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);` + (uid ? 'set role authenticated;' : ''));
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
}
async function err(uid, sql, params) {
  try { await as(uid, sql, params); return null; } catch (e) { return e.message; }
}
// Supabase-like setup
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(schema);
console.log('schema applied');

await db.query(`insert into auth.users values ($1,'a@x.com','{"full_name":"David Cardoso","avatar_url":"https://lh3.googleusercontent.com/a/x"}'),($2,'7up@x.com','{}')`, [A, B]);
let r = await as(A, `select display_name from public.subjects order by display_name`);
ok(r.rows.length === 7, 'new user gets 7 default subjects: ' + r.rows.map(x=>x.display_name).join(', '));
r = await as(A, `select * from public.user_settings`);
ok(r.rows.length === 1 && r.rows[0].week_start === 1, 'settings row created, week starts Monday');

r = await as(A, `select (public.add_subject('  linear   algebra ')).display_name`);
ok(r.rows[0].display_name === 'Linear Algebra', 'normalizes "  linear   algebra " -> ' + r.rows[0].display_name);
r = await as(A, `select (public.add_subject('AP bio')).display_name`);
ok(r.rows[0].display_name === 'AP Bio', 'keeps acronyms: AP bio -> ' + r.rows[0].display_name);
ok((await err(A, `select public.add_subject('LINEAR algebra')`))?.includes('subject_exists'), 'duplicate (case-insensitive) -> subject_exists');
ok((await err(A, `select public.add_subject('   ')`))?.includes('subject_name_invalid'), 'blank name rejected');
await as(A, `update public.subjects set is_active=false where name_key='linear algebra'`);
r = await as(A, `select * from public.add_subject('linear Algebra')`);
ok(r.rows[0].is_active && r.rows[0].display_name === 'Linear Algebra', 're-adding a removed subject reactivates it');
r = await as(A, `select count(*)::int c from public.subjects where name_key='linear algebra'`);
ok(r.rows[0].c === 1, 'no duplicate row created');


// profiles / usernames
r = await as(A, `select * from public.profiles`);
ok(r.rows.length === 1 && /^david_\d{4}$/.test(r.rows[0].username) && r.rows[0].display_name === 'David Cardoso', 'auto username from Google name: ' + r.rows[0].username);
r = await as(B, `select username from public.profiles`);
ok(/^user7up_\d{4}$/.test(r.rows[0].username), 'name starting with a digit gets "user" prefix: ' + r.rows[0].username);
r = await as(B, `select count(*)::int c from public.profiles`);
ok(r.rows[0].c === 1, "B cannot see A's profile (until friends exist)");
ok((await err(A, `update public.profiles set username='David.C'`))?.includes('username_invalid'), 'username with a dot rejected');
ok((await err(A, `update public.profiles set username='ab'`))?.includes('username_invalid'), 'too-short username rejected');
ok((await err(A, `update public.profiles set username='Admin'`))?.includes('username_reserved'), 'reserved username rejected');
r = await as(A, `update public.profiles set username='  DavidC ' returning username, username_changed_at`);
ok(r.rows[0].username === 'davidc' && r.rows[0].username_changed_at, 'username saved lowercase, change time recorded');
ok((await err(B, `update public.profiles set username='DAVIDC'`))?.includes('username_taken'), 'username uniqueness ignores case');
r = await as(B, `select public.username_available('davidc') a, public.username_available('support') b, public.username_available('9lives') c, public.username_available('freebird') d`);
ok(r.rows[0].a === 'taken' && r.rows[0].b === 'reserved' && r.rows[0].c === 'invalid' && r.rows[0].d === 'available', 'username_available: taken / reserved / invalid / available');
r = await as(A, `update public.profiles set avatar_url='https://evil.example/pixel.gif' returning avatar_url`);
ok(r.rows[0].avatar_url === 'https://lh3.googleusercontent.com/a/x', 'users cannot change avatar_url');
r = await as(A, `select public.username_available('davidc') a`);
ok(r.rows[0].a === 'available', 'your own username shows as available to you');

// isolation
r = await as(B, `select count(*)::int c from public.subjects`);
ok(r.rows[0].c === 7, 'user B sees only own 7 subjects');
const aMath = (await as(A, `select id from public.subjects where name_key='math'`)).rows[0].id;
ok(!!(await err(B, `insert into public.study_sessions (subject_id, duration_minutes, session_date) values ($1, 30, current_date)`, [aMath])), "B cannot log a session on A's subject");
ok(!!(await err(B, `update public.subjects set display_name='hacked' where id=$1 returning id`, [aMath])) || (await as(B, `update public.subjects set display_name='hacked' where id=$1 returning id`, [aMath])).rows.length === 0, "B cannot rename A's subject");
ok(!!(await err(A, `delete from public.subjects where id=$1`, [aMath])), 'hard delete of subjects is denied');
await db.exec(`reset role; set role anon;`);
try { await db.query(`select * from public.subjects`); ok(false, 'anon cannot read subjects'); } catch { ok(true, 'anon cannot read subjects'); }
try { await db.query(`select public.timer_get()`); ok(false, 'anon cannot call timer_get'); } catch { ok(true, 'anon cannot call timer_get'); }
await db.exec('reset role;');

// sessions
await as(A, `update public.user_settings set timezone='America/Los_Angeles', onboarded_at=now()`);
ok((await err(A, `update public.user_settings set timezone='Mars/Base'`))?.includes('timezone_invalid'), 'invalid timezone rejected');
r = await as(A, `insert into public.study_sessions (subject_id, duration_minutes, session_date, note) values ($1, 90, current_date - 1, '  chapter 3  ') returning *`, [aMath]);
ok(r.rows[0].note === 'chapter 3' && r.rows[0].source === 'manual', 'manual entry saved, note trimmed');
const s1 = r.rows[0].id;
r = await as(A, `select display_name from public.subjects where is_active order by last_used_at desc nulls last, display_name limit 3`);
ok(r.rows.map(x=>x.display_name).join(',') === 'Math,Linear Algebra,AP Bio', 'dropdown is most-recently-used first: ' + r.rows.map(x=>x.display_name).join(', '));
r = await as(B, `select display_name from public.subjects where is_active order by last_used_at desc nulls last, display_name limit 1`);
ok(r.rows[0].display_name === 'Computer Science', 'never-used subjects fall back to A-Z');
ok((await err(A, `insert into public.study_sessions (subject_id, duration_minutes, session_date) values ($1, 30, current_date + 3)`, [aMath]))?.includes('session_date_in_future'), 'future date rejected');
ok(!!(await err(A, `insert into public.study_sessions (subject_id, duration_minutes, session_date, note) values ($1, 30, current_date - 1, repeat('x', 501))`, [aMath])), 'note over 500 chars rejected');
ok(!!(await err(A, `insert into public.study_sessions (subject_id, duration_minutes, session_date) values ($1, 0, current_date - 1)`, [aMath])), '0-minute entry rejected');
ok((await err(A, `insert into public.study_sessions (subject_id, duration_minutes, session_date) values ($1, 1400, current_date - 1)`, [aMath]))?.includes('daily_limit_exceeded'), 'more than 24h on one day rejected');
// inactive subject
const hist = (await as(A, `select id from public.subjects where name_key='history'`)).rows[0].id;
await as(A, `update public.subjects set is_active=false where id=$1`, [hist]);
ok((await err(A, `insert into public.study_sessions (subject_id, duration_minutes, session_date) values ($1, 30, current_date - 2)`, [hist]))?.includes('subject_inactive'), 'removed subject cannot be used on new entries');
await as(A, `update public.subjects set is_active=true where id=$1`, [hist]);
r = await as(A, `insert into public.study_sessions (subject_id, duration_minutes, session_date) values ($1, 30, current_date - 2) returning id`, [hist]);
const s2 = r.rows[0].id;
await as(A, `update public.subjects set is_active=false where id=$1`, [hist]);
r = await as(A, `update public.study_sessions set duration_minutes=45 where id=$1 returning duration_minutes`, [s2]);
ok(r.rows[0].duration_minutes === 45, 'old entry on a removed subject can still be edited');
// soft delete
await as(A, `update public.study_sessions set deleted_at=now() where id=$1`, [s1]);
r = await as(A, `select count(*)::int c from public.visible_study_sessions`);
ok(r.rows[0].c === 1, 'soft-deleted session hidden from visible view');
await as(A, `update public.study_sessions set deleted_at=null where id=$1`, [s1]);
r = await as(A, `select count(*)::int c from public.visible_study_sessions`);
ok(r.rows[0].c === 2, 'undo restores it');
ok(!!(await err(A, `delete from public.study_sessions where id=$1`, [s1])), 'hard delete of sessions denied');
r = await as(B, `select count(*)::int c from public.study_sessions`);
ok(r.rows[0].c === 0, "B sees none of A's sessions");

// timer
ok(!!(await err(A, `insert into public.active_timers (user_id, subject_id, started_at, last_active_at) values ($1,$2,now(),now())`, [A, aMath])), 'timer table cannot be written directly');
r = await as(A, `select public.timer_start($1, 'ch 4') j`, [aMath]);
let t = r.rows[0].j.timer;
ok(t && t.version === 1 && t.paused_at === null, 'timer started');
ok((await err(A, `select public.timer_start($1)`, [aMath]))?.includes('timer_already_running'), 'second timer refused (shared across devices)');
// simulate 50 minutes elapsed, 10 of them paused
await db.query(`update public.active_timers set started_at = now() - interval '60 minutes', last_active_at = now() - interval '5 minutes'`);
r = await as(A, `select public.timer_pause(1) j`); t = r.rows[0].j.timer;
ok(t.version === 2 && t.paused_at, 'paused');
ok((await err(A, `select public.timer_resume(1)`))?.includes('timer_conflict'), 'stale version from another device -> timer_conflict');
await db.query(`update public.active_timers set paused_at = now() - interval '10 minutes'`);
r = await as(A, `select public.timer_resume(2) j`); t = r.rows[0].j.timer;
ok(t.version === 3 && Math.round(t.elapsed_seconds/60) === 50, 'resumed; elapsed = 50 min (60 - 10 paused): ' + t.elapsed_seconds + 's');
ok((await err(A, `select public.timer_update_details(3, $1, 'x')`, [aMath]))?.includes('timer_not_paused'), 'cannot edit details while running');
r = await as(B, `select public.timer_get() j`);
ok(r.rows[0].j.timer === null, "B cannot see A's timer");
r = await as(A, `select public.timer_save(3) j`);
let j = r.rows[0].j;
ok(j.timer === null && j.session.duration_minutes === 50 && j.session.source === 'stopwatch' && j.session.note === 'ch 4', 'saved as 50-minute stopwatch session with note');
// welcome back: last_active option
await as(A, `select public.timer_start($1)`, [aMath]);
await db.query(`update public.active_timers set started_at = now() - interval '3 hours', last_active_at = now() - interval '2 hours'`);
r = await as(A, `select public.timer_save(1, 'last_active') j`);
ok(r.rows[0].j.session.duration_minutes === 60, 'Welcome Back "stop when I was last here" saves 60 min, not 3h');
// edit time then save
await as(A, `select public.timer_start($1)`, [aMath]);
r = await as(A, `select public.timer_save(1, 'now', 25) j`);
ok(r.rows[0].j.session.duration_minutes === 25, 'Welcome Back "edit the time" saves chosen minutes');
// too short
await as(A, `select public.timer_start($1)`, [aMath]);
ok((await err(A, `select public.timer_save(1)`))?.includes('session_too_short'), 'under 30s -> session_too_short');
await as(A, `select public.timer_discard(1)`);
r = await as(A, `select public.timer_get() j`);
ok(r.rows[0].j.timer === null, 'discard removes timer');
// 24h cap
await as(A, `select public.timer_start($1)`, [aMath]);
await db.query(`update public.active_timers set started_at = now() - interval '30 hours'`);
r = await as(A, `select public.timer_get() j`);
ok(r.rows[0].j.timer.elapsed_seconds === 86400, 'elapsed caps at 24h');
await as(A, `select public.timer_discard(1)`);
// midnight crossover: started 23:30 LA yesterday -> dated yesterday
await as(A, `select public.timer_start($1)`, [aMath]);
await db.query(`update public.active_timers set started_at = ((now() at time zone 'America/Los_Angeles')::date - 1 + time '23:30') at time zone 'America/Los_Angeles'`);
r = await as(A, `select public.timer_save(1, 'now', 60) j, ((now() at time zone 'America/Los_Angeles')::date - 1)::text y`);
ok(r.rows[0].j.session.session_date === r.rows[0].y && r.rows[0].j.session.session_time === '23:30:00', 'session past midnight counts on the start day: ' + r.rows[0].j.session.session_date + ' ' + r.rows[0].j.session.session_time);

// subject limit
await db.query(`delete from private.write_budget`);
await db.exec(`select set_config('request.jwt.claim.sub','',false)`); await db.query(`do $$ begin for i in 1..91 loop insert into public.subjects (user_id, display_name) values ('${B}', 'Topic ' || i); end loop; end $$;`);
r = await as(B, `select count(*) filter (where is_active)::int c from public.subjects`);
ok(r.rows[0].c === 98, 'B has 98 active subjects');
await as(B, `select public.add_subject('Ninety Nine')`);
await as(B, `select public.add_subject('One Hundred')`);
ok((await err(B, `select public.add_subject('One Oh One')`))?.includes('subject_limit_reached'), '101st active subject -> subject_limit_reached');

// rate limit
await db.query(`delete from private.write_budget`);
let rl = null;
for (let i = 0; i < 70 && !rl; i++) rl = await err(A, `update public.user_settings set theme_mode = $1`, [i % 2 ? 'dark' : 'light']);
ok(rl?.includes('rate_limited'), 'write 61 within a minute -> rate_limited');

// account deletion cascades
await db.query(`delete from auth.users where id = $1`, [A]);
r = await db.query(`select (select count(*) from public.subjects where user_id=$1)::int s, (select count(*) from public.study_sessions where user_id=$1)::int ss, (select count(*) from public.user_settings where user_id=$1)::int + (select count(*) from public.profiles where user_id=$1)::int us`, [A]);
ok(r.rows[0].s + r.rows[0].ss + r.rows[0].us === 0, 'deleting the account removes all of its data');
// purge
r = await db.query(`select private.purge_deleted_sessions() n`);
ok(r.rows[0].n === 0, 'purge job runs');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
