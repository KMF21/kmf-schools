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
