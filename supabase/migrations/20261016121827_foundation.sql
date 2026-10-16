-- KMF Schools — foundation schema
-- One database serves every school. Every school-owned row carries school_id,
-- and row level security (RLS) makes sure people only ever see rows of the
-- schools they belong to, in the roles they hold there.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.school_role as enum ('owner', 'admin', 'teacher', 'bursar', 'parent', 'student');
create type public.school_status as enum ('setup', 'active', 'suspended');
create type public.domain_kind as enum ('portal', 'website');
create type public.section_kind as enum ('nursery', 'primary', 'junior_secondary', 'senior_secondary');
create type public.assessment_style as enum ('score', 'rating');
create type public.student_status as enum ('active', 'graduated', 'withdrawn', 'suspended');
create type public.gender as enum ('female', 'male');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Schools and their addresses
-- ---------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  name text not null check (length(trim(name)) > 0),
  short_name text,
  motto text,
  address text,
  phone text,
  email text,
  logo_path text,
  stamp_path text,
  brand_color text not null default '#1a8754' check (brand_color ~* '^#[0-9a-f]{6}$'),
  status public.school_status not null default 'setup',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger schools_touch before update on public.schools
  for each row execute function private.touch_updated_at();

-- Exact hostnames a school is served on, e.g. portal.brightfield.com.ng.
-- Platform subdomains (brightfield.kmfschools.ng) need no row: the slug is used.
create table public.school_domains (
  hostname text primary key check (hostname = lower(hostname) and hostname !~ '[:/ ]'),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.domain_kind not null default 'portal',
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index school_domains_school_idx on public.school_domains (school_id);

-- KMF Enterprise staff who manage every school on the platform.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Who belongs to which school, and in what role.
create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.school_role not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, user_id, role)
);
create index school_members_user_idx on public.school_members (user_id);

-- ---------------------------------------------------------------------------
-- Access checks used by every policy. SECURITY DEFINER so they can read
-- school_members without recursing through its own policies.
-- ---------------------------------------------------------------------------
create or replace function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create or replace function private.has_role(p_school uuid, p_roles public.school_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin() or exists (
    select 1 from public.school_members m
    where m.school_id = p_school and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

create or replace function private.is_member(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin() or exists (
    select 1 from public.school_members m
    where m.school_id = p_school and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_staff(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(p_school, array['owner', 'admin', 'teacher', 'bursar']::public.school_role[]);
$$;

create or replace function private.is_manager(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(p_school, array['owner', 'admin']::public.school_role[]);
$$;

grant execute on all functions in schema private to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Academic calendar
-- ---------------------------------------------------------------------------
create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,                -- e.g. 2026/2027
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);
create unique index academic_sessions_one_current on public.academic_sessions (school_id) where is_current;

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  session_id uuid not null,
  term_number smallint not null check (term_number between 1 and 3),
  name text not null,                -- e.g. First term
  starts_on date,
  ends_on date,
  next_term_begins date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (session_id, school_id) references public.academic_sessions (id, school_id) on delete cascade,
  unique (session_id, term_number),
  unique (id, school_id)
);
create unique index terms_one_current on public.terms (school_id) where is_current;

-- ---------------------------------------------------------------------------
-- School structure: sections → class levels → arms, and subjects
-- ---------------------------------------------------------------------------
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.section_kind not null,
  name text not null,
  assessment_style public.assessment_style not null default 'score',
  is_enabled boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, kind),
  unique (id, school_id)
);

create table public.class_levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  section_id uuid not null,
  name text not null,                -- e.g. JSS 1, Basic 7, Year 7
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  foreign key (section_id, school_id) references public.sections (id, school_id) on delete cascade,
  unique (school_id, name),
  unique (id, school_id)
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  title text,                        -- Mr, Mrs, Dr
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  position text,                     -- e.g. Vice Principal (Academics)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id)
);
create index staff_school_idx on public.staff (school_id);
create unique index staff_user_per_school on public.staff (school_id, user_id) where user_id is not null;
create trigger staff_touch before update on public.staff
  for each row execute function private.touch_updated_at();

create table public.class_arms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_level_id uuid not null,
  name text not null,                -- e.g. A, Gold
  form_teacher_id uuid,
  created_at timestamptz not null default now(),
  foreign key (class_level_id, school_id) references public.class_levels (id, school_id) on delete cascade,
  foreign key (form_teacher_id, school_id) references public.staff (id, school_id) on delete set null (form_teacher_id),
  unique (class_level_id, name),
  unique (id, school_id)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);

-- Which subjects each class level takes. Electives (SSS streams) are chosen per student later.
create table public.class_subjects (
  school_id uuid not null,
  class_level_id uuid not null,
  subject_id uuid not null,
  is_elective boolean not null default false,
  stream text,                       -- Science, Arts, Commercial (SSS only)
  sort_order smallint not null default 0,
  primary key (class_level_id, subject_id),
  foreign key (class_level_id, school_id) references public.class_levels (id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects (id, school_id) on delete cascade
);

create table public.teaching_assignments (
  school_id uuid not null,
  staff_id uuid not null,
  class_arm_id uuid not null,
  subject_id uuid not null,
  primary key (class_arm_id, subject_id, staff_id),
  foreign key (staff_id, school_id) references public.staff (id, school_id) on delete cascade,
  foreign key (class_arm_id, school_id) references public.class_arms (id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects (id, school_id) on delete cascade
);
create index teaching_assignments_staff_idx on public.teaching_assignments (staff_id);

-- ---------------------------------------------------------------------------
-- Grading configuration (results themselves come in the next milestone)
-- ---------------------------------------------------------------------------
create table public.grading_scales (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  section_id uuid not null,
  name text not null,
  bands jsonb not null,              -- [{min, max, grade, remark}], validated in the app
  created_at timestamptz not null default now(),
  foreign key (section_id, school_id) references public.sections (id, school_id) on delete cascade,
  unique (section_id)
);

create table public.assessment_components (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  section_id uuid not null,
  name text not null,                -- CA 1, CA 2, Exam
  max_score numeric(5, 2) not null check (max_score > 0),
  sort_order smallint not null default 0,
  foreign key (section_id, school_id) references public.sections (id, school_id) on delete cascade,
  unique (section_id, name)
);

-- ---------------------------------------------------------------------------
-- People: students and guardians
-- ---------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  admission_no text not null,
  admission_key text generated always as (
    regexp_replace(regexp_replace(lower(trim(admission_no)), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')
  ) stored,
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender public.gender,
  date_of_birth date,
  class_arm_id uuid,
  status public.student_status not null default 'active',
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_arm_id, school_id) references public.class_arms (id, school_id) on delete set null (class_arm_id),
  unique (school_id, admission_key),
  unique (id, school_id)
);
create index students_class_idx on public.students (class_arm_id);
create index students_user_idx on public.students (user_id);
create trigger students_touch before update on public.students
  for each row execute function private.touch_updated_at();

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  unique (id, school_id)
);
create index guardians_user_idx on public.guardians (user_id);

create table public.student_guardians (
  school_id uuid not null,
  student_id uuid not null,
  guardian_id uuid not null,
  relationship text,                 -- Father, Mother, Guardian
  primary key (student_id, guardian_id),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  foreign key (guardian_id, school_id) references public.guardians (id, school_id) on delete cascade
);
create index student_guardians_guardian_idx on public.student_guardians (guardian_id);

-- Students the signed-in person may see as a student or parent.
create or replace function private.my_student_ids(p_school uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  where s.school_id = p_school and s.user_id = (select auth.uid())
  union
  select sg.student_id from public.student_guardians sg
  join public.guardians g on g.id = sg.guardian_id
  where sg.school_id = p_school and g.user_id = (select auth.uid());
$$;
grant execute on function private.my_student_ids(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Announcements (shown in the portal and, if public, on the website)
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  body text not null default '',
  audience text not null default 'everyone' check (audience in ('everyone', 'staff', 'parents', 'public')),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcements_school_idx on public.announcements (school_id, published_at desc);

-- ---------------------------------------------------------------------------
-- Public lookup: which school is this address? Returns branding only.
-- Anyone (including signed-out visitors) may call it.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_school(p_hostname text default null, p_slug text default null)
returns table (
  id uuid, slug text, name text, short_name text, motto text, address text,
  phone text, email text, logo_path text, brand_color text, status public.school_status
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.slug, s.name, s.short_name, s.motto, s.address, s.phone, s.email,
         s.logo_path, s.brand_color, s.status
  from public.schools s
  where s.status <> 'suspended'
    and (
      (p_slug is not null and s.slug = lower(p_slug))
      or (p_hostname is not null and s.id = (
        select d.school_id from public.school_domains d where d.hostname = lower(p_hostname)
      ))
    )
  limit 1;
$$;
revoke all on function public.resolve_school(text, text) from public;
grant execute on function public.resolve_school(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.school_domains enable row level security;
alter table public.platform_admins enable row level security;
alter table public.school_members enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.terms enable row level security;
alter table public.sections enable row level security;
alter table public.class_levels enable row level security;
alter table public.class_arms enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.staff enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.grading_scales enable row level security;
alter table public.assessment_components enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.announcements enable row level security;

-- Schools: members read their school; managers update it; only KMF creates or deletes schools.
create policy schools_read on public.schools for select to authenticated using (private.is_member(id));
create policy schools_update on public.schools for update to authenticated
  using (private.is_manager(id)) with check (private.is_manager(id));
create policy schools_platform on public.schools for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- Domains: managers read; only KMF changes them (they need DNS work).
create policy domains_read on public.school_domains for select to authenticated using (private.is_manager(school_id));
create policy domains_platform on public.school_domains for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy platform_admins_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- Memberships: people see their own; managers see and manage everyone in their school,
-- but only an owner (or KMF) can grant the owner role.
create policy members_read on public.school_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_manager(school_id));
create policy members_insert on public.school_members for insert to authenticated
  with check (private.is_manager(school_id) and (role <> 'owner' or private.has_role(school_id, array['owner']::public.school_role[])));
create policy members_update on public.school_members for update to authenticated
  using (private.is_manager(school_id))
  with check (private.is_manager(school_id) and (role <> 'owner' or private.has_role(school_id, array['owner']::public.school_role[])));
create policy members_delete on public.school_members for delete to authenticated
  using (private.is_manager(school_id) and (role <> 'owner' or private.has_role(school_id, array['owner']::public.school_role[])));

-- School configuration tables: every member reads, managers write.
do $$
declare t text;
begin
  foreach t in array array[
    'academic_sessions', 'terms', 'sections', 'class_levels', 'class_arms', 'subjects',
    'class_subjects', 'grading_scales', 'assessment_components'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_member(school_id))', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.is_manager(school_id)) with check (private.is_manager(school_id))', t || '_manage', t);
  end loop;
end $$;

-- Staff: staff read the staff list; managers write; anyone reads their own record.
create policy staff_read on public.staff for select to authenticated
  using (private.is_staff(school_id) or user_id = (select auth.uid()));
create policy staff_manage on public.staff for all to authenticated
  using (private.is_manager(school_id)) with check (private.is_manager(school_id));

create policy teaching_read on public.teaching_assignments for select to authenticated using (private.is_staff(school_id));
create policy teaching_manage on public.teaching_assignments for all to authenticated
  using (private.is_manager(school_id)) with check (private.is_manager(school_id));

-- Students: staff read all in their school; students and parents read only their own.
create policy students_read on public.students for select to authenticated
  using (private.is_staff(school_id) or id in (select private.my_student_ids(school_id)));
create policy students_manage on public.students for all to authenticated
  using (private.is_manager(school_id)) with check (private.is_manager(school_id));

create policy guardians_read on public.guardians for select to authenticated
  using (private.is_staff(school_id) or user_id = (select auth.uid()));
create policy guardians_manage on public.guardians for all to authenticated
  using (private.is_manager(school_id)) with check (private.is_manager(school_id));

create policy student_guardians_read on public.student_guardians for select to authenticated
  using (private.is_staff(school_id) or student_id in (select private.my_student_ids(school_id)));
create policy student_guardians_manage on public.student_guardians for all to authenticated
  using (private.is_manager(school_id)) with check (private.is_manager(school_id));

-- Announcements: audience-aware reads; managers write.
create policy announcements_read on public.announcements for select to authenticated using (
  published_at is not null and published_at <= now() and private.is_member(school_id) and (
    audience in ('everyone', 'public')
    or (audience = 'staff' and private.is_staff(school_id))
    or (audience = 'parents' and private.has_role(school_id, array['parent', 'owner', 'admin']::public.school_role[]))
  )
  or private.is_manager(school_id)
);
create policy announcements_public on public.announcements for select to anon
  using (audience = 'public' and published_at is not null and published_at <= now());
create policy announcements_manage on public.announcements for all to authenticated
  using (private.is_manager(school_id)) with check (private.is_manager(school_id));
