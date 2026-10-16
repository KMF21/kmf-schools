import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const repo = new URL("../..", import.meta.url).pathname;
const db = new PGlite();

// Minimal stand-in for Supabase's auth schema and roles.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

// Every migration in order, except storage (which needs Supabase's storage schema).
for (const file of readdirSync(`${repo}/supabase/migrations`).filter((f) => f.endsWith(".sql") && !f.includes("storage")).sort()) {
  await db.exec(readFileSync(`${repo}/supabase/migrations/${file}`, "utf8"));
}
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
`);
await db.exec(readFileSync(`${repo}/supabase/seed.sql`, "utf8"));
console.log("migration + seed: ok");

// A second school, users, and memberships.
const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const u = (n) => `00000000-0000-4000-9000-00000000000${n}`;
await db.exec(`
  insert into public.schools (id, slug, name, status) values ('${B}', 'hillside', 'Hillside College', 'active');
  insert into public.school_domains (hostname, school_id) values ('portal.hillside.com.ng', '${B}');
  insert into auth.users values ('${u(1)}'), ('${u(2)}'), ('${u(3)}'), ('${u(4)}'), ('${u(5)}'), ('${u(6)}');
  insert into public.school_members (school_id, user_id, role, display_name) values
    ('${A}', '${u(1)}', 'admin', 'A admin'),
    ('${A}', '${u(2)}', 'teacher', 'A teacher'),
    ('${A}', '${u(3)}', 'parent', 'A parent'),
    ('${B}', '${u(4)}', 'admin', 'B admin'),
    ('${A}', '${u(6)}', 'student', 'A student');
  insert into public.students (id, school_id, admission_no, first_name, last_name, user_id) values
    ('10000000-0000-4000-8000-000000000001', '${A}', 'BFA/2026/001', 'Ada', 'Musa', null),
    ('10000000-0000-4000-8000-000000000002', '${A}', 'BFA/2026/002', 'Bello', 'Danjuma', '${u(6)}'),
    ('10000000-0000-4000-8000-000000000003', '${B}', 'HC/001', 'Chidi', 'Okafor', null);
  insert into public.guardians (id, school_id, full_name, user_id) values ('20000000-0000-4000-8000-000000000001', '${A}', 'Mrs Musa', '${u(3)}');
  insert into public.announcements (school_id, title, audience, published_at) values ('${A}', 'Staff meeting', 'staff', now());
  insert into public.student_guardians (school_id, student_id, guardian_id) values ('${A}', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
`);

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`}`);
};

async function as(user, fn) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${user ?? ""}', false);`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
const count = async (sql) => Number((await db.query(sql)).rows[0].n);
const names = async (sql) => (await db.query(sql)).rows.map((r) => Object.values(r)[0]);

await as(u(1), async () => {
  check("A admin sees only A's students", await count("select count(*) n from public.students"), 2);
  check("A admin sees only school A", await names("select slug from public.schools"), ["brightfield"]);
  let blocked = false;
  try { await db.exec(`insert into public.students (school_id, admission_no, first_name, last_name) values ('${B}', 'X1', 'X', 'Y')`); }
  catch { blocked = true; }
  check("A admin cannot add a student to school B", blocked, true);
  const added = await db.query(`insert into public.students (school_id, admission_no, first_name, last_name) values ('${A}', 'BFA/2026/099', 'New', 'Pupil') returning id`);
  check("A admin can add a student to own school", added.rows.length, 1);
  await db.exec(`delete from public.students where admission_no = 'BFA/2026/099'`);
  let ownerBlocked = false;
  try { await db.exec(`insert into public.school_members (school_id, user_id, role, display_name) values ('${A}', '${u(5)}', 'owner', 'x')`); }
  catch { ownerBlocked = true; }
  check("admin cannot grant the owner role", ownerBlocked, true);
});

await as(u(4), async () => {
  check("B admin sees only B's students", await names("select first_name from public.students"), ["Chidi"]);
  check("B admin sees no A classes", await count(`select count(*) n from public.class_levels where school_id = '${A}'`), 0);
});

await as(u(2), async () => {
  check("teacher sees all students in own school", await count("select count(*) n from public.students"), 2);
  check("teacher sees staff-only announcements", await count("select count(*) n from public.announcements where audience = 'staff'"), 1);
  check("teacher cannot delete a student", (await db.query(`delete from public.students where school_id = '${A}' returning id`)).rows.length, 0);
  check("teacher cannot edit school settings", (await db.query(`update public.schools set name = 'x' where id = '${A}' returning id`)).rows.length, 0);
});

await as(u(3), async () => {
  check("parent sees only their own child", await names("select first_name from public.students"), ["Ada"]);
  check("parent cannot see the staff list", await count("select count(*) n from public.staff"), 0);
  check("parent cannot see staff-only announcements", await count("select count(*) n from public.announcements where audience = 'staff'"), 0);
  check("parent sees announcements meant for everyone", await count("select count(*) n from public.announcements"), 2);
});

await as(u(6), async () => {
  check("student sees only themselves", await names("select first_name from public.students"), ["Bello"]);
});

// Structure tools: adding a section and setting the current term.
const setupSql = (school) => `select public.setup_section('${school}', 'junior_secondary', 'Junior Secondary', 'score',
  array['JSS 1','JSS 2'], array['A','B'], array['Mathematics','English Studies'],
  '{"Science": ["Basic Science"]}'::jsonb,
  '[{"name":"CA 1","maxScore":40},{"name":"Exam","maxScore":60}]'::jsonb,
  'Standard scale', '[{"min":0,"max":100,"grade":"P","remark":"Pass"}]'::jsonb)`;
const refusedTo = async (sql) => { try { await db.exec(sql); return false; } catch { return true; } };

await as(u(4), async () => {
  await db.exec(setupSql(B));
  check("admin adds a section with its classes in one step", await count(`select count(*) n from public.class_levels where school_id = '${B}'`), 2);
  check("each class gets its arms", await count(`select count(*) n from public.class_arms where school_id = '${B}'`), 4);
  check("each class gets core and elective subjects", await count(`select count(*) n from public.class_subjects where school_id = '${B}'`), 6);
  check("the section gets its CA/exam components and grading scale",
    await count(`select (select count(*) from public.assessment_components where school_id = '${B}') + (select count(*) from public.grading_scales where school_id = '${B}') as n`), 3);
  check("adding the same section twice is refused, leaving nothing half-done", await refusedTo(setupSql(B)), true);
  check("one admin cannot add sections to another school", await refusedTo(setupSql(A)), true);

  await db.exec(`select public.set_current_term('${B}', '2026/2027', 1::smallint, '2026-09-14', '2026-12-11', '2027-01-11')`);
  await db.exec(`select public.set_current_term('${B}', '2026/2027', 2::smallint, '2027-01-11', '2027-04-02', '2027-04-26')`);
  check("exactly one current term after changing it", await names(`select name from public.terms where school_id = '${B}' and is_current`), ["Second term"]);
  const sec = (await db.query(`select id from public.sections where school_id = '${B}'`)).rows[0].id;
  const comps = (await db.query(`select id, name from public.assessment_components where section_id = '${sec}' order by sort_order`)).rows;
  const bandsJson = `'[{"min":50,"max":100,"grade":"P","remark":"Pass"},{"min":0,"max":49,"grade":"F","remark":"Fail"}]'::jsonb`;
  // Swap the names of the two components and add a third, totalling 100.
  await db.exec(`select public.save_grading('${sec}', '[{"id":"${comps[0].id}","name":"Exam","maxScore":50},{"id":"${comps[1].id}","name":"CA 1","maxScore":30},{"id":null,"name":"Project","maxScore":20}]'::jsonb, 'My scale', ${bandsJson})`);
  check("grading save renames, reorders and adds in one step",
    (await db.query(`select name from public.assessment_components where section_id = '${sec}' order by sort_order`)).rows.map((r) => r.name), ["Exam", "CA 1", "Project"]);
  check("grading save stores the new scale", await names(`select name from public.grading_scales where section_id = '${sec}'`), ["My scale"]);
  check("grading that doesn't total 100 is refused",
    await refusedTo(`select public.save_grading('${sec}', '[{"id":null,"name":"Exam","maxScore":90}]'::jsonb, 'x', ${bandsJson})`), true);
  check("a refused grading save changes nothing", await count(`select count(*) n from public.assessment_components where section_id = '${sec}'`), 3);
  const aSection = (await db.query(`select id from public.sections where school_id = '${A}' and assessment_style = 'score' limit 1`)).rows[0]?.id;
  check("one admin cannot change another school's grading", await refusedTo(`select public.save_grading('${aSection}', '[{"id":null,"name":"Exam","maxScore":100}]'::jsonb, 'x', ${bandsJson})`), true);

  check("changing the term doesn't touch other schools", await names(`select name from public.terms where school_id = '${A}' and is_current`), []);
});
check("other school's current term is unchanged", await names(`select name from public.terms where school_id = '${A}' and is_current`), ["First term"]);
await as(u(2), async () => {
  check("teachers cannot add sections", await refusedTo(setupSql(A)), true);
  check("teachers cannot change the term", await refusedTo(`select public.set_current_term('${A}', '2026/2027', 2::smallint, null, null, null)`), true);
});

await db.exec(`insert into public.platform_admins (user_id) values ('${u(5)}')`);
await as(u(5), async () => {
  const made = await db.query(`insert into public.schools (slug, name) values ('newschool', 'New School') returning id`);
  check("KMF admin can create a school", made.rows.length, 1);
});
await as(u(1), async () => {
  let refused = false;
  try { await db.exec(`insert into public.schools (slug, name) values ('rogue', 'Rogue School')`); } catch { refused = true; }
  check("school admin cannot create a school", refused, true);
});
await db.exec(`delete from public.platform_admins where user_id = '${u(5)}'`);

await as(u(5), async () => {
  check("person with no membership sees nothing", await count("select count(*) n from public.students"), 0);
});

await as(null, async () => {
  check("signed-out visitor resolves school by slug", await names("select name from public.resolve_school(null, 'brightfield')"), ["Brightfield Academy"]);
  check("signed-out visitor resolves school by domain", await names("select name from public.resolve_school('portal.hillside.com.ng', null)"), ["Hillside College"]);
  check("unknown domain resolves to nothing", await count("select count(*) n from public.resolve_school('nope.example', null)"), 0);
  check("signed-out visitor sees only public announcements", await count("select count(*) n from public.announcements"), 1);
  check("signed-out visitor cannot read students", await count("select count(*) n from public.students"), 0);
});

// Integrity: a class arm cannot point at another school's class level.
let crossBlocked = false;
try {
  await db.exec(`insert into public.class_arms (school_id, class_level_id, name) select '${B}', id, 'Z' from public.class_levels where school_id = '${A}' limit 1`);
} catch { crossBlocked = true; }
check("database rejects cross-school links", crossBlocked, true);

check("admission numbers are unique per school regardless of formatting", await (async () => {
  try { await db.exec(`insert into public.students (school_id, admission_no, first_name, last_name) values ('${A}', ' bfa-2026-001 ', 'Dup', 'Licate')`); return false; }
  catch { return true; }
})(), true);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
