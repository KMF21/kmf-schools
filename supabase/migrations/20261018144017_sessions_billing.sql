-- Finding a school from the home page, promoting students into a new session,
-- and KMF billing (with publishing locked until the term is paid).

-- ---------------------------------------------------------------------------
-- Find your school: live schools by name, public details only.
-- ---------------------------------------------------------------------------
create or replace function public.find_schools(p_query text)
returns table (slug text, name text, address text, logo_path text, brand_color text)
language sql stable security definer set search_path = '' as $$
  select s.slug, s.name, s.address, s.logo_path, s.brand_color
  from public.schools s
  where s.status = 'active'
    and length(trim(coalesce(p_query, ''))) >= 3
    and (
      s.name ilike '%' || replace(replace(replace(trim(p_query), '\', ''), '%', ''), '_', '') || '%'
      or s.short_name ilike '%' || replace(replace(replace(trim(p_query), '\', ''), '%', ''), '_', '') || '%'
    )
  order by s.name
  limit 8;
$$;
revoke all on function public.find_schools(text) from public;
grant execute on function public.find_schools(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Promotion: moves a whole school into the next session in one step.
-- Each move is {"studentId": uuid, "action": "move"|"stay"|"graduate"|"withdraw", "armId": uuid}.
-- ---------------------------------------------------------------------------
create table public.promotion_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  from_session text not null,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index promotion_runs_school_idx on public.promotion_runs (school_id);
create index promotion_runs_created_by_idx on public.promotion_runs (created_by);
alter table public.promotion_runs enable row level security;
create policy promotion_runs_read on public.promotion_runs for select to authenticated using (private.is_manager(school_id));
create policy promotion_runs_insert on public.promotion_runs for insert to authenticated with check (private.is_manager(school_id));

create or replace function public.promote_students(p_school uuid, p_from_session text, p_moves jsonb)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_move jsonb;
  v_action text;
  v_moved int := 0;
  v_stayed int := 0;
  v_graduated int := 0;
  v_withdrawn int := 0;
  v_count int;
begin
  if not private.is_manager(p_school) then
    raise exception 'Only the proprietor or school admin can promote students' using errcode = '42501';
  end if;
  if jsonb_typeof(p_moves) <> 'array' or jsonb_array_length(p_moves) = 0 then
    raise exception 'Nothing to promote' using errcode = '22023';
  end if;

  for v_move in select value from jsonb_array_elements(p_moves) loop
    v_action := v_move ->> 'action';
    if v_action = 'move' then
      update public.students
        set class_arm_id = (v_move ->> 'armId')::uuid
        where id = (v_move ->> 'studentId')::uuid and school_id = p_school and status = 'active';
      get diagnostics v_count = row_count;
      v_moved := v_moved + v_count;
    elsif v_action = 'graduate' then
      update public.students set status = 'graduated'
        where id = (v_move ->> 'studentId')::uuid and school_id = p_school and status = 'active';
      get diagnostics v_count = row_count;
      v_graduated := v_graduated + v_count;
    elsif v_action = 'withdraw' then
      update public.students set status = 'withdrawn'
        where id = (v_move ->> 'studentId')::uuid and school_id = p_school and status = 'active';
      get diagnostics v_count = row_count;
      v_withdrawn := v_withdrawn + v_count;
    elsif v_action = 'stay' then
      v_stayed := v_stayed + 1;
    else
      raise exception 'Unknown choice for a student: %', v_action using errcode = '22023';
    end if;
  end loop;

  insert into public.promotion_runs (school_id, from_session, summary)
  values (p_school, p_from_session, jsonb_build_object('moved', v_moved, 'stayed', v_stayed, 'graduated', v_graduated, 'withdrawn', v_withdrawn));

  return jsonb_build_object('moved', v_moved, 'stayed', v_stayed, 'graduated', v_graduated, 'withdrawn', v_withdrawn);
end $$;
revoke all on function public.promote_students(uuid, text, jsonb) from public, anon;
grant execute on function public.promote_students(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Billing. Only KMF writes these; a school's managers can read their own.
-- ---------------------------------------------------------------------------
create table public.billing_plans (
  school_id uuid primary key references public.schools (id) on delete cascade,
  plan text not null default 'per_student' check (plan in ('per_student', 'yearly', 'free')),
  rate numeric(12, 2) not null default 2000 check (rate >= 0),            -- per student per term
  minimum_students integer not null default 200 check (minimum_students >= 0),
  yearly_amount numeric(12, 2) not null default 1000000 check (yearly_amount >= 0),
  grace_days integer not null default 14 check (grace_days between 0 and 120),
  notes text,
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  session_id uuid not null,
  term_id uuid,                       -- null for a yearly invoice covering the whole session
  label text not null,                -- e.g. First term, 2026/2027
  student_count integer,
  rate numeric(12, 2),
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  due_on date not null,
  paid_at timestamptz,
  payment_note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (session_id, school_id) references public.academic_sessions (id, school_id) on delete cascade,
  foreign key (term_id, school_id) references public.terms (id, school_id) on delete cascade
);
create unique index invoices_one_per_term on public.invoices (school_id, term_id) where term_id is not null;
create unique index invoices_one_per_year on public.invoices (school_id, session_id) where term_id is null;
create index invoices_session_idx on public.invoices (session_id, school_id);
create index invoices_term_idx on public.invoices (term_id, school_id);
create index invoices_created_by_idx on public.invoices (created_by);

alter table public.billing_plans enable row level security;
alter table public.invoices enable row level security;

create policy billing_plans_read on public.billing_plans for select to authenticated using (private.is_manager(school_id));
create policy billing_plans_insert on public.billing_plans for insert to authenticated with check (private.is_platform_admin());
create policy billing_plans_update on public.billing_plans for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy billing_plans_delete on public.billing_plans for delete to authenticated using (private.is_platform_admin());

create policy invoices_read on public.invoices for select to authenticated using (private.is_manager(school_id));
create policy invoices_insert on public.invoices for insert to authenticated with check (private.is_platform_admin());
create policy invoices_update on public.invoices for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy invoices_delete on public.invoices for delete to authenticated using (private.is_platform_admin());

-- Results for a term can be published when: KMF is publishing, the school is on
-- the free plan, or there's an invoice for the term (or the whole session) that
-- is paid, waived, or unpaid but still within its grace period.
create or replace function private.can_publish(p_school uuid, p_term uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
    or exists (select 1 from public.billing_plans p where p.school_id = p_school and p.plan = 'free')
    or exists (
      select 1 from public.invoices i
      join public.terms t on t.id = p_term and t.school_id = p_school
      where i.school_id = p_school
        and (i.term_id = p_term or (i.term_id is null and i.session_id = t.session_id))
        and (i.status in ('paid', 'waived') or (i.status = 'unpaid' and current_date <= i.due_on))
    );
$$;
revoke all on function private.can_publish(uuid, uuid) from public;
grant execute on function private.can_publish(uuid, uuid) to authenticated;

alter policy result_releases_insert on public.result_releases
  with check (private.is_manager(school_id) and private.can_publish(school_id, term_id));

-- Schools already on the platform keep working as before (free) until KMF sets
-- their plan; new schools start on the per-student plan.
insert into public.billing_plans (school_id, plan)
select id, 'free' from public.schools
on conflict (school_id) do nothing;

create or replace function private.school_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.add_default_traits(new.id);
  insert into public.billing_plans (school_id) values (new.id) on conflict (school_id) do nothing;
  return new;
end $$;

-- Each student's average across all subjects and terms of a session, to help
-- the school spot students who may need to repeat before promoting.
create or replace function public.session_averages(p_school uuid, p_session uuid)
returns table (student_id uuid, average numeric, terms integer)
language sql stable security invoker set search_path = '' as $$
  with totals as (
    select s.student_id, s.term_id, s.subject_id, sum(s.score) as total
    from public.scores s
    join public.terms t on t.id = s.term_id
    where s.school_id = p_school and t.session_id = p_session
    group by s.student_id, s.term_id, s.subject_id
  )
  select student_id, round(avg(total), 2), count(distinct term_id)::integer
  from totals
  group by student_id;
$$;
revoke all on function public.session_averages(uuid, uuid) from public, anon;
grant execute on function public.session_averages(uuid, uuid) to authenticated;
