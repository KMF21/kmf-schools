import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const repo = new URL("../..", import.meta.url).pathname;
const db = new PGlite();

// Minimal stand-in for Supabase's auth schema and roles.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

// Every migration in order, except storage (which needs Supabase's storage schema).
for (const file of readdirSync(`${repo}/supabase/migrations`).filter((f) => f.endsWith(".sql") && !f.includes("storage")).sort()) {
  await db.exec(readFileSync(`${repo}/supabase/migrations/${file}`, "utf8"));
}
// Like Supabase after 30 October 2026: tables get no access unless a migration grants it.
await db.exec(`grant usage on schema public to anon, authenticated, service_role;`);
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

// Looked up outside any session: school B's admin can't see school A's classes.
const aArm = (await db.query(`select id from public.class_arms where school_id = '${A}' limit 1`)).rows[0].id;

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

  // Imports
  const arm = (await db.query(`select id from public.class_arms where school_id = '${B}' limit 1`)).rows[0].id;
  const studentsJson = (rows) => `'${JSON.stringify(rows).replace(/'/g, "''")}'::jsonb`;
  const res = (await db.query(`select public.import_students('${B}', ${studentsJson([
    { admission_no: "HC/100", first_name: "Ngozi", last_name: "Eze", gender: "female", date_of_birth: "2014-04-03", class_arm_id: arm, guardian_name: "Mrs Eze", guardian_phone: "08030000001" },
    { admission_no: "HC/101", first_name: "Obi", last_name: "Eze", gender: "male", class_arm_id: arm, guardian_name: "Mrs Eze", guardian_phone: "08030000001" },
    { admission_no: "hc-001", first_name: "Chidi", last_name: "Okafor" },
  ])}, false) as r`)).rows[0].r;
  check("import adds new students and skips existing admission numbers", [res.created, res.skipped], [2, 1]);
  check("brothers and sisters share one parent record", res.guardians, 1);
  check("the shared parent is linked to both children",
    await count(`select count(*) n from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where g.phone = '08030000001'`), 2);
  const res2 = (await db.query(`select public.import_students('${B}', ${studentsJson([{ admission_no: "HC/100", first_name: "Ngozi", last_name: "Eze-Obi" }])}, true) as r`)).rows[0].r;
  check("re-importing with updates refreshes existing students", [res2.updated, await names(`select last_name from public.students where admission_no = 'HC/100'`)], [1, ["Eze-Obi"]]);
  check("re-importing keeps the class when the file leaves it blank", await count(`select count(*) n from public.students where admission_no = 'HC/100' and class_arm_id is not null`), 1);
  check("an import that puts a student in another school's class is refused entirely",
    await refusedTo(`select public.import_students('${B}', ${studentsJson([{ admission_no: "HC/200", first_name: "A", last_name: "B" }, { admission_no: "HC/201", first_name: "C", last_name: "D", class_arm_id: aArm }])}, false)`), true);
  check("a refused import adds nobody", await count(`select count(*) n from public.students where admission_no in ('HC/200', 'HC/201')`), 0);
  check("one admin cannot import into another school", await refusedTo(`select public.import_students('${A}', ${studentsJson([{ admission_no: "X1", first_name: "A", last_name: "B" }])}, false)`), true);

  const staffRes = (await db.query(`select public.import_staff('${B}', ${studentsJson([
    { title: "Mrs", first_name: "Grace", last_name: "Ishaku", email: "Grace@School.ng", position: "Teacher" },
    { first_name: "Samuel", last_name: "Adamu", phone: "08030000002" },
  ])}) as r`)).rows[0].r;
  const staffAgain = (await db.query(`select public.import_staff('${B}', ${studentsJson([{ first_name: "G", last_name: "I", email: "grace@school.ng" }, { first_name: "Samuel", last_name: "Adamu", phone: "08030000002" }])}) as r`)).rows[0].r;
  check("staff import adds staff, then skips them on a second import", [staffRes.created, staffAgain.created, staffAgain.skipped], [2, 0, 2]);

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
  check("a new school starts with the standard behaviour and skills list", await count(`select count(*) n from public.report_traits where school_id = '${made.rows[0].id}'`), 12);
});
await as(u(1), async () => {
  let refused = false;
  try { await db.exec(`insert into public.schools (slug, name) values ('rogue', 'Rogue School')`); } catch { refused = true; }
  check("school admin cannot create a school", refused, true);
});
await as(u(1), async () => {
  check("school admin cannot switch their school's status", await refusedTo(`update public.schools set status = 'suspended' where id = '${A}'`), true);
  check("school admin cannot change their school's web name", await refusedTo(`update public.schools set slug = 'renamed' where id = '${A}'`), true);
  check("school admin can still rename their school", await refusedTo(`update public.schools set motto = 'Learning for life' where id = '${A}'`), false);
  check("school admin cannot connect a domain", await refusedTo(`insert into public.school_domains (hostname, school_id) values ('portal.brightfield.com.ng', '${A}')`), true);
});
await as(u(5), async () => {
  check("KMF admin sees every school", await count("select count(*) n from public.schools"), 3);
  check("KMF admin can change a school's status", await refusedTo(`update public.schools set status = 'setup' where id = '${B}'`), false);
  await db.exec(`update public.schools set status = 'active' where id = '${B}'`);
  check("KMF admin can connect a domain", await refusedTo(`insert into public.school_domains (hostname, school_id, kind) values ('www.brightfield.com.ng', '${A}', 'website')`), false);
});
await db.exec(`delete from public.platform_admins where user_id = '${u(5)}'`);

await as(u(5), async () => {
  check("person with no membership sees nothing", await count("select count(*) n from public.students"), 0);
});

check("signed-in users cannot look up accounts by email", await (async () => {
  await db.exec(`set role authenticated`);
  try { await db.exec(`select public.auth_user_id_by_email('x@y.z')`); return false; } catch { return true; } finally { await db.exec("reset role"); }
})(), true);

await as(null, async () => {
  check("signed-out visitor resolves school by slug", await names("select name from public.resolve_school(null, 'brightfield')"), ["Brightfield Academy"]);
  check("signed-out visitor resolves school by domain", await names("select name from public.resolve_school('portal.hillside.com.ng', null)"), ["Hillside College"]);
  check("unknown domain resolves to nothing", await count("select count(*) n from public.resolve_school('nope.example', null)"), 0);
  check("signed-out visitor sees only public announcements", await count("select count(*) n from public.announcements"), 1);
  check("signed-out visitor cannot read students", await refusedTo("select count(*) n from public.students"), true);
});


// ---------------------------------------------------------------- Results
const one = async (sql) => (await db.query(sql)).rows[0];
const ADA = "10000000-0000-4000-8000-000000000001";
const BELLO = "10000000-0000-4000-8000-000000000002";
const OTHER = "10000000-0000-4000-8000-000000000009";
const R = await one(`
  select a.id arm, a2.id arm2, t.id term, c.id comp, c.max_score max,
    (select id from public.subjects where school_id = '${A}' and name = 'Mathematics') math,
    (select id from public.subjects where school_id = '${A}' and name <> 'Mathematics' order by name limit 1) other
  from public.class_arms a
  join public.class_levels l on l.id = a.class_level_id
  join public.sections s on s.id = l.section_id and s.assessment_style = 'score'
  join public.assessment_components c on c.section_id = s.id
  join public.class_arms a2 on a2.class_level_id = l.id and a2.id <> a.id
  join public.terms t on t.school_id = '${A}' and t.is_current
  where a.school_id = '${A}' order by l.sort_order, a.name, c.sort_order limit 1`);
const STAFF = "30000000-0000-4000-8000-000000000001";
await db.exec(`
  insert into public.staff (id, school_id, user_id, first_name, last_name) values ('${STAFF}', '${A}', '${u(2)}', 'A', 'Teacher');
  update public.students set class_arm_id = '${R.arm}' where id in ('${ADA}', '${BELLO}');
  insert into public.students (id, school_id, admission_no, first_name, last_name, class_arm_id) values ('${OTHER}', '${A}', 'BFA/2026/009', 'Other', 'Class', '${R.arm2}');
`);
const score = (student, subject, value, arm = R.arm) =>
  `insert into public.scores (school_id, term_id, class_arm_id, student_id, subject_id, component_id, score)
   values ('${A}', '${R.term}', '${arm}', '${student}', '${subject}', '${R.comp}', ${value})
   on conflict (term_id, student_id, subject_id, component_id) do update set score = excluded.score`;

await as(u(2), async () => {
  check("teachers cannot assign teachers", await refusedTo(`select public.save_class_teachers('${R.arm}', '${STAFF}', '[]'::jsonb)`), true);
  check("teacher with no class cannot enter scores", await refusedTo(score(ADA, R.math, 10)), true);
});
await as(u(1), async () => {
  check("admin assigns a subject teacher", await refusedTo(`select public.save_class_teachers('${R.arm}', null, '[{"subjectId":"${R.math}","staffId":"${STAFF}"}]'::jsonb)`), false);
});
await as(u(2), async () => {
  check("subject teacher enters a score", await refusedTo(score(ADA, R.math, 10)), false);
  check("subject teacher cannot score another subject", await refusedTo(score(ADA, R.other, 10)), true);
  check("scores above the maximum are refused", await refusedTo(score(ADA, R.math, Number(R.max) + 1)), true);
  check("teacher cannot score a student from another class", await refusedTo(score(OTHER, R.math, 10)), true);
  check("subject teacher cannot write report comments", await refusedTo(`insert into public.term_reports (school_id, term_id, class_arm_id, student_id, teacher_comment) values ('${A}', '${R.term}', '${R.arm}', '${ADA}', 'Good')`), true);
});
await as(u(1), async () => {
  check("admin makes them form teacher too", await refusedTo(`select public.save_class_teachers('${R.arm}', '${STAFF}', '[{"subjectId":"${R.math}","staffId":"${STAFF}"}]'::jsonb)`), false);
  check("admin enters a score for any subject", await refusedTo(score(BELLO, R.other, 12)), false);
});
await as(u(2), async () => {
  check("form teacher scores any subject in their class", await refusedTo(score(ADA, R.other, 11)), false);
  check("form teacher writes their comment", await refusedTo(`insert into public.term_reports (school_id, term_id, class_arm_id, student_id, days_present, teacher_comment) values ('${A}', '${R.term}', '${R.arm}', '${ADA}', 60, 'A good term')`), false);
  check("form teacher cannot write the head's comment", await refusedTo(`update public.term_reports set head_comment = 'Promoted' where student_id = '${ADA}'`), true);
  check("teacher cannot publish results", await refusedTo(`insert into public.result_releases (school_id, term_id, class_arm_id) values ('${A}', '${R.term}', '${R.arm}')`), true);
});
await as(u(3), async () => {
  check("parent cannot see unpublished results", await count(`select count(*) n from public.scores`), 0);
});
await as(u(4), async () => {
  check("another school cannot see the scores", await count(`select count(*) n from public.scores`), 0);
});
await as(u(1), async () => {
  check("admin writes the head's comment", await refusedTo(`update public.term_reports set head_comment = 'Promoted' where student_id = '${ADA}'`), false);
  check("a CA with scores can't be removed", await refusedTo(`delete from public.assessment_components where id = '${R.comp}'`), true);
  const publish = `insert into public.result_releases (school_id, term_id, class_arm_id) values ('${A}', '${R.term}', '${R.arm}')`;
  check("publishing is locked until KMF's invoice for the term exists", await refusedTo(publish), true);
  check("school admin cannot create their own invoice", await refusedTo(`insert into public.invoices (school_id, session_id, term_id, label, amount, due_on) select '${A}', session_id, id, 'x', 0, current_date + 30 from public.terms where id = '${R.term}'`), true);
  check("school admin cannot switch to the free plan", (await db.query(`update public.billing_plans set plan = 'free' where school_id = '${A}' returning plan`)).rows.length, 0);
  check("school admin can see their billing plan", await count(`select count(*) n from public.billing_plans`), 1);
});
// KMF issues an invoice that is already overdue and unpaid.
await db.exec(`insert into public.invoices (school_id, session_id, term_id, label, amount, due_on) select '${A}', session_id, id, 'Term', 400000, current_date - 1 from public.terms where id = '${R.term}'`);
await as(u(1), async () => {
  const publish = `insert into public.result_releases (school_id, term_id, class_arm_id) values ('${A}', '${R.term}', '${R.arm}')`;
  check("an overdue unpaid invoice keeps publishing locked", await refusedTo(publish), true);
});
await db.exec(`update public.invoices set due_on = current_date + 7 where school_id = '${A}'`);
await as(u(1), async () => {
  check("within the grace period, publishing works", await refusedTo(`insert into public.result_releases (school_id, term_id, class_arm_id) values ('${A}', '${R.term}', '${R.arm}')`), false);
  await db.exec(`delete from public.result_releases where class_arm_id = '${R.arm}'`);
});
await db.exec(`update public.invoices set status = 'paid', paid_at = now() where school_id = '${A}'`);
await as(u(4), async () => {
  check("another school cannot see this school's invoices", await count(`select count(*) n from public.invoices`), 0);
});
await as(u(1), async () => {
  check("admin publishes the class once paid", await refusedTo(`insert into public.result_releases (school_id, term_id, class_arm_id) values ('${A}', '${R.term}', '${R.arm}')`), false);
  check("published results are locked, even for the admin", await refusedTo(score(ADA, R.math, 15)), true);
});
await as(u(2), async () => {
  check("published results are locked for teachers", (await db.query(`update public.scores set score = 1 where student_id = '${ADA}' returning score`)).rows.length, 0);
});
await as(u(3), async () => {
  check("parent sees their child's published results", await count(`select count(*) n from public.scores where student_id = '${ADA}'`), 2);
  check("parent sees no other child's results", await count(`select count(*) n from public.scores where student_id <> '${ADA}'`), 0);
  check("parent sees the report comments", await names(`select head_comment from public.term_reports`), ["Promoted"]);
  const rows = (await db.query(`select student_key from public.class_scores_for_report('${R.term}', '${R.arm}', '${ADA}')`)).rows.map((r) => r.student_key);
  check("parent gets class figures with classmates anonymous", rows.includes("me") && rows.every((k) => k === "me" || /^[0-9a-f]{32}$/.test(k)), true);
  check("parent cannot get class figures for another child", await refusedTo(`select * from public.class_scores_for_report('${R.term}', '${R.arm}', '${BELLO}')`), true);
});
await as(u(6), async () => {
  check("student sees only their own results", await names(`select distinct student_id from public.scores`), [BELLO]);
});
await as(u(1), async () => {
  check("admin unpublishes to make changes", await refusedTo(`delete from public.result_releases where class_arm_id = '${R.arm}'`), false);
  check("changes are allowed again", await refusedTo(score(ADA, R.math, 15)), false);
});
await as(u(3), async () => {
  check("unpublished results are hidden from parents again", await count(`select count(*) n from public.scores`), 0);
  check("class figures are hidden again too", await refusedTo(`select * from public.class_scores_for_report('${R.term}', '${R.arm}', '${ADA}')`), true);
});


// ---------------------------------------------------------------- Promotion and search
await as(u(1), async () => {
  const avg = await db.query(`select student_id, average from public.session_averages('${A}', (select session_id from public.terms where id = '${R.term}'))`);
  check("session averages cover students with scores", avg.rows.length >= 1, true);
});
await as(u(3), async () => {
  check("parents get no class-wide averages", await count(`select count(*) n from public.session_averages('${A}', (select session_id from public.terms where id = '${R.term}'))`), 0);
});
await as(u(2), async () => {
  check("teachers cannot promote students", await refusedTo(`select public.promote_students('${A}', '2026/2027', '[{"studentId":"${OTHER}","action":"graduate"}]'::jsonb)`), true);
});
await as(u(1), async () => {
  const r = await one(`select public.promote_students('${A}', '2026/2027', '[{"studentId":"${OTHER}","action":"move","armId":"${R.arm}"},{"studentId":"${BELLO}","action":"stay"}]'::jsonb) as r`);
  check("admin promotes students in one step", r.r, { moved: 1, stayed: 1, graduated: 0, withdrawn: 0 });
  check("the moved student is in the new class", await names(`select class_arm_id from public.students where id = '${OTHER}'`), [R.arm]);
  check("a move into another school's class is refused", await refusedTo(`select public.promote_students('${A}', '2026/2027', '[{"studentId":"${OTHER}","action":"move","armId":"00000000-0000-4000-8000-0000000000ff"}]'::jsonb)`), true);
  check("promotion leaves no half-done changes after an error", await names(`select class_arm_id from public.students where id = '${OTHER}'`), [R.arm]);
});
await as(u(4), async () => {
  check("another school's admin cannot promote these students", (await one(`select public.promote_students('${B}', 'x', '[{"studentId":"${OTHER}","action":"graduate"}]'::jsonb) as r`)).r.graduated, 0);
});
await as(null, async () => {
  check("visitors find a live school by part of its name", await names(`select name from public.find_schools('hills')`), ["Hillside College"]);
  check("searches under 3 letters return nothing", await count(`select count(*) n from public.find_schools('hi')`), 0);
  check("search results show no private details", (await db.query(`select * from public.find_schools('hills')`)).fields.map((f) => f.name), ["slug", "name", "address", "logo_path", "brand_color"]);
});

// Every table must have its access granted in a migration.
const ungranted = (await db.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not (has_table_privilege('authenticated', c.oid, 'select') and has_table_privilege('service_role', c.oid, 'select'))
  order by 1`)).rows.map((r) => r.relname);
check("every table has its access granted in a migration", ungranted, []);
const anonTables = (await db.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select') order by 1`)).rows.map((r) => r.relname);
check("signed-out visitors can only read announcements directly", anonTables, ["announcements"]);
const noRls = (await db.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`)).rows.map((r) => r.relname);
check("every table has row level security on", noRls, []);

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
