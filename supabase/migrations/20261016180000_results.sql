-- Results: scores, nursery ratings, report details (attendance, comments,
-- behaviour and skills), and publishing. Totals, grades and positions are not
-- stored: the portal works them out from the scores, so they are never stale.

-- Days the school opened this term (for "present 58 of 62 days").
alter table public.terms add column if not exists days_open smallint check (days_open between 0 and 200);

-- Lets scores point at a component of the same school.
alter table public.assessment_components add constraint assessment_components_id_school_key unique (id, school_id);

-- ---------------------------------------------------------------------------
-- Behaviour and skills rated on report cards. Each school edits its own list.
-- ---------------------------------------------------------------------------
create table public.report_traits (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind text not null check (kind in ('behaviour', 'skill')),
  name text not null check (length(trim(name)) between 1 and 60),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);

-- ---------------------------------------------------------------------------
-- Scores (CA and exam) for score-based sections
-- ---------------------------------------------------------------------------
create table public.scores (
  school_id uuid not null,
  term_id uuid not null,
  class_arm_id uuid not null,       -- the class the student was in when scored
  student_id uuid not null,
  subject_id uuid not null,
  component_id uuid not null,
  score numeric(5, 2) not null check (score >= 0),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (term_id, student_id, subject_id, component_id),
  foreign key (term_id, school_id) references public.terms (id, school_id) on delete cascade,
  foreign key (class_arm_id, school_id) references public.class_arms (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects (id, school_id) on delete cascade,
  -- A CA or exam that already has scores can't be removed by accident.
  foreign key (component_id, school_id) references public.assessment_components (id, school_id) on delete restrict
);
create index scores_class_idx on public.scores (term_id, class_arm_id);
create index scores_arm_school_idx on public.scores (class_arm_id, school_id);
create index scores_student_idx on public.scores (student_id, school_id);
create index scores_subject_idx on public.scores (subject_id, school_id);
create index scores_component_idx on public.scores (component_id, school_id);
create index scores_term_school_idx on public.scores (term_id, school_id);
create index scores_updated_by_idx on public.scores (updated_by);

-- ---------------------------------------------------------------------------
-- Ratings (e.g. Excellent, Good) for rating-based sections such as nursery
-- ---------------------------------------------------------------------------
create table public.ratings (
  school_id uuid not null,
  term_id uuid not null,
  class_arm_id uuid not null,
  student_id uuid not null,
  subject_id uuid not null,
  rating text not null check (length(trim(rating)) between 1 and 40),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (term_id, student_id, subject_id),
  foreign key (term_id, school_id) references public.terms (id, school_id) on delete cascade,
  foreign key (class_arm_id, school_id) references public.class_arms (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects (id, school_id) on delete cascade
);
create index ratings_class_idx on public.ratings (term_id, class_arm_id);
create index ratings_arm_school_idx on public.ratings (class_arm_id, school_id);
create index ratings_student_idx on public.ratings (student_id, school_id);
create index ratings_subject_idx on public.ratings (subject_id, school_id);
create index ratings_term_school_idx on public.ratings (term_id, school_id);
create index ratings_updated_by_idx on public.ratings (updated_by);

-- ---------------------------------------------------------------------------
-- The rest of each report card: attendance, comments, behaviour and skills
-- ---------------------------------------------------------------------------
create table public.term_reports (
  school_id uuid not null,
  term_id uuid not null,
  class_arm_id uuid not null,
  student_id uuid not null,
  days_present smallint check (days_present between 0 and 200),
  teacher_comment text check (length(teacher_comment) <= 400),
  head_comment text check (length(head_comment) <= 400),
  traits jsonb not null default '{}'::jsonb check (jsonb_typeof(traits) = 'object'),  -- {traitId: 1..5}
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (term_id, student_id),
  foreign key (term_id, school_id) references public.terms (id, school_id) on delete cascade,
  foreign key (class_arm_id, school_id) references public.class_arms (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade
);
create index term_reports_class_idx on public.term_reports (term_id, class_arm_id);
create index term_reports_arm_school_idx on public.term_reports (class_arm_id, school_id);
create index term_reports_student_idx on public.term_reports (student_id, school_id);
create index term_reports_term_school_idx on public.term_reports (term_id, school_id);
create index term_reports_updated_by_idx on public.term_reports (updated_by);

-- ---------------------------------------------------------------------------
-- Publishing: a class's results for a term are visible to its students and
-- parents once released, and locked against changes until unpublished.
-- ---------------------------------------------------------------------------
create table public.result_releases (
  school_id uuid not null,
  term_id uuid not null,
  class_arm_id uuid not null,
  published_at timestamptz not null default now(),
  published_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (term_id, class_arm_id),
  foreign key (term_id, school_id) references public.terms (id, school_id) on delete cascade,
  foreign key (class_arm_id, school_id) references public.class_arms (id, school_id) on delete cascade
);
create index result_releases_arm_school_idx on public.result_releases (class_arm_id, school_id);
create index result_releases_term_school_idx on public.result_releases (term_id, school_id);
create index result_releases_published_by_idx on public.result_releases (published_by);

-- ---------------------------------------------------------------------------
-- Access checks
-- ---------------------------------------------------------------------------

-- Teaches this subject in this class.
create or replace function private.teaches(p_school uuid, p_arm uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teaching_assignments ta
    join public.staff s on s.id = ta.staff_id
    where ta.school_id = p_school and ta.class_arm_id = p_arm and ta.subject_id = p_subject
      and s.user_id = (select auth.uid()) and s.is_active
  );
$$;

-- Form (class) teacher of this class. In primary and nursery they usually teach every subject.
create or replace function private.is_form_teacher(p_school uuid, p_arm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_arms a
    join public.staff s on s.id = a.form_teacher_id
    where a.school_id = p_school and a.id = p_arm and s.user_id = (select auth.uid()) and s.is_active
  );
$$;

create or replace function private.is_released(p_term uuid, p_arm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.result_releases r where r.term_id = p_term and r.class_arm_id = p_arm);
$$;

-- Who may read a result row: staff always; a student or their parent once it's published.
create or replace function private.can_read_result(p_school uuid, p_term uuid, p_arm uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff(p_school)
    or (p_student in (select private.my_student_ids(p_school)) and private.is_released(p_term, p_arm));
$$;

-- Who may write scores or ratings: managers, the subject teacher, or the form teacher.
create or replace function private.can_enter_scores(p_school uuid, p_term uuid, p_arm uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.is_released(p_term, p_arm) and (
    private.is_manager(p_school) or private.teaches(p_school, p_arm, p_subject) or private.is_form_teacher(p_school, p_arm)
  );
$$;

create or replace function private.can_write_report(p_school uuid, p_term uuid, p_arm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.is_released(p_term, p_arm) and (private.is_manager(p_school) or private.is_form_teacher(p_school, p_arm));
$$;

revoke all on function private.teaches(uuid, uuid, uuid), private.is_form_teacher(uuid, uuid), private.is_released(uuid, uuid),
  private.can_read_result(uuid, uuid, uuid, uuid), private.can_enter_scores(uuid, uuid, uuid, uuid), private.can_write_report(uuid, uuid, uuid) from public;
grant execute on function private.teaches(uuid, uuid, uuid), private.is_form_teacher(uuid, uuid), private.is_released(uuid, uuid),
  private.can_read_result(uuid, uuid, uuid, uuid), private.can_enter_scores(uuid, uuid, uuid, uuid), private.can_write_report(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Checks that rules can't express
-- ---------------------------------------------------------------------------

-- Teachers can only record results for students who are in that class now.
-- (Managers may correct older results after students have moved class.)
create or replace function private.check_in_class(p_school uuid, p_student uuid, p_arm uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  -- auth.uid() is set for people using the portal; database admins and server jobs skip this check.
  if (select auth.uid()) is not null and not private.is_manager(p_school)
     and not exists (select 1 from public.students s where s.id = p_student and s.class_arm_id = p_arm) then
    raise exception 'That student is not in this class' using errcode = '42501';
  end if;
end $$;

-- A score must fit its CA or exam, and belong to the class's section.
create or replace function private.check_score() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_max numeric;
  v_comp_section uuid;
  v_arm_section uuid;
begin
  select c.max_score, c.section_id into v_max, v_comp_section from public.assessment_components c where c.id = new.component_id;
  select l.section_id into v_arm_section from public.class_arms a join public.class_levels l on l.id = a.class_level_id where a.id = new.class_arm_id;
  if v_comp_section is distinct from v_arm_section then
    raise exception 'That CA or exam belongs to another section' using errcode = '22023';
  end if;
  if new.score > v_max then
    raise exception 'Score % is above the maximum of %', new.score, v_max using errcode = '22023';
  end if;
  perform private.check_in_class(new.school_id, new.student_id, new.class_arm_id);
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end $$;
create trigger scores_check before insert or update on public.scores for each row execute function private.check_score();

create or replace function private.stamp_result() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.check_in_class(new.school_id, new.student_id, new.class_arm_id);
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end $$;
create trigger ratings_stamp before insert or update on public.ratings for each row execute function private.stamp_result();

-- Form teachers fill attendance, their comment and ratings; only managers write the head's comment.
create or replace function private.check_term_report() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_manager(new.school_id)
     and new.head_comment is distinct from (case when tg_op = 'UPDATE' then old.head_comment else null end) then
    raise exception 'Only the proprietor or school admin can write the head''s comment' using errcode = '42501';
  end if;
  perform private.check_in_class(new.school_id, new.student_id, new.class_arm_id);
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end $$;
create trigger term_reports_check before insert or update on public.term_reports for each row execute function private.check_term_report();

revoke all on function private.check_score(), private.stamp_result(), private.check_term_report() from public;
revoke all on function private.check_in_class(uuid, uuid, uuid) from public;
grant execute on function private.check_in_class(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.report_traits enable row level security;
alter table public.scores enable row level security;
alter table public.ratings enable row level security;
alter table public.term_reports enable row level security;
alter table public.result_releases enable row level security;

create policy report_traits_read on public.report_traits for select to authenticated using (private.is_member(school_id));
create policy report_traits_insert on public.report_traits for insert to authenticated with check (private.is_manager(school_id));
create policy report_traits_update on public.report_traits for update to authenticated using (private.is_manager(school_id)) with check (private.is_manager(school_id));
create policy report_traits_delete on public.report_traits for delete to authenticated using (private.is_manager(school_id));

create policy scores_read on public.scores for select to authenticated
  using (private.can_read_result(school_id, term_id, class_arm_id, student_id));
create policy scores_insert on public.scores for insert to authenticated
  with check (private.can_enter_scores(school_id, term_id, class_arm_id, subject_id));
create policy scores_update on public.scores for update to authenticated
  using (private.can_enter_scores(school_id, term_id, class_arm_id, subject_id))
  with check (private.can_enter_scores(school_id, term_id, class_arm_id, subject_id));
create policy scores_delete on public.scores for delete to authenticated
  using (private.can_enter_scores(school_id, term_id, class_arm_id, subject_id));

create policy ratings_read on public.ratings for select to authenticated
  using (private.can_read_result(school_id, term_id, class_arm_id, student_id));
create policy ratings_insert on public.ratings for insert to authenticated
  with check (private.can_enter_scores(school_id, term_id, class_arm_id, subject_id));
create policy ratings_update on public.ratings for update to authenticated
  using (private.can_enter_scores(school_id, term_id, class_arm_id, subject_id))
  with check (private.can_enter_scores(school_id, term_id, class_arm_id, subject_id));
create policy ratings_delete on public.ratings for delete to authenticated
  using (private.can_enter_scores(school_id, term_id, class_arm_id, subject_id));

create policy term_reports_read on public.term_reports for select to authenticated
  using (private.can_read_result(school_id, term_id, class_arm_id, student_id));
create policy term_reports_insert on public.term_reports for insert to authenticated
  with check (private.can_write_report(school_id, term_id, class_arm_id));
create policy term_reports_update on public.term_reports for update to authenticated
  using (private.can_write_report(school_id, term_id, class_arm_id))
  with check (private.can_write_report(school_id, term_id, class_arm_id));
create policy term_reports_delete on public.term_reports for delete to authenticated
  using (private.can_write_report(school_id, term_id, class_arm_id));

create policy result_releases_read on public.result_releases for select to authenticated using (private.is_member(school_id));
create policy result_releases_insert on public.result_releases for insert to authenticated with check (private.is_manager(school_id));
create policy result_releases_delete on public.result_releases for delete to authenticated using (private.is_manager(school_id));

-- ---------------------------------------------------------------------------
-- Saving a class's teachers in one step
-- ---------------------------------------------------------------------------
create or replace function public.save_class_teachers(
  p_arm uuid,
  p_form_teacher uuid,     -- staff id, or null
  p_assignments jsonb      -- [{"subjectId": uuid, "staffId": uuid}, ...]
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_school uuid;
begin
  select school_id into v_school from public.class_arms where id = p_arm;
  if v_school is null or not private.is_manager(v_school) then
    raise exception 'Only school managers can assign teachers' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) <> 'array' then
    raise exception 'Assignments must be a list' using errcode = '22023';
  end if;

  update public.class_arms set form_teacher_id = p_form_teacher where id = p_arm;

  delete from public.teaching_assignments where class_arm_id = p_arm;
  insert into public.teaching_assignments (school_id, staff_id, class_arm_id, subject_id)
  select distinct v_school, (a ->> 'staffId')::uuid, p_arm, (a ->> 'subjectId')::uuid
  from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) a
  where a ->> 'staffId' is not null and a ->> 'subjectId' is not null;
end $$;

revoke all on function public.save_class_teachers(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_class_teachers(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Every school starts with the standard behaviour and skills list (editable).
-- ---------------------------------------------------------------------------
create or replace function private.add_default_traits(p_school uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.report_traits (school_id, kind, name, sort_order)
  select p_school, t.kind, t.name, t.ord
  from (values
    ('behaviour', 'Punctuality', 1), ('behaviour', 'Neatness', 2), ('behaviour', 'Politeness', 3),
    ('behaviour', 'Honesty', 4), ('behaviour', 'Relationship with others', 5), ('behaviour', 'Attentiveness', 6),
    ('behaviour', 'Self-control', 7),
    ('skill', 'Handwriting', 8), ('skill', 'Verbal fluency', 9), ('skill', 'Sports and games', 10),
    ('skill', 'Drawing and crafts', 11), ('skill', 'Musical skills', 12)
  ) as t(kind, name, ord)
  on conflict (school_id, name) do nothing;
$$;
revoke all on function private.add_default_traits(uuid) from public;

create or replace function private.school_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.add_default_traits(new.id);
  return new;
end $$;
revoke all on function private.school_defaults() from public;
create trigger schools_defaults after insert on public.schools for each row execute function private.school_defaults();

select private.add_default_traits(id) from public.schools;

-- ---------------------------------------------------------------------------
-- A parent or student sees only their own child's scores, but a report card
-- also needs the class's averages and positions. This returns the class's
-- scores for one published report with every other student made anonymous.
-- ---------------------------------------------------------------------------
create or replace function public.class_scores_for_report(p_term uuid, p_arm uuid, p_student uuid)
returns table (student_key text, subject_id uuid, component_id uuid, score numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_school uuid;
begin
  select a.school_id into v_school from public.class_arms a where a.id = p_arm;
  if v_school is null or not private.can_read_result(v_school, p_term, p_arm, p_student) then
    raise exception 'You can''t see this report' using errcode = '42501';
  end if;
  return query
    select case when s.student_id = p_student then 'me' else md5(s.student_id::text || p_term::text) end,
           s.subject_id, s.component_id, s.score
    from public.scores s
    where s.term_id = p_term and s.class_arm_id = p_arm and s.school_id = v_school;
end $$;
revoke all on function public.class_scores_for_report(uuid, uuid, uuid) from public, anon;
grant execute on function public.class_scores_for_report(uuid, uuid, uuid) to authenticated;
