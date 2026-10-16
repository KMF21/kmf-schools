-- Bulk import of students (with their parents) and staff, each in one
-- transaction: the whole file goes in, or nothing does. Rows are cleaned and
-- checked in the app first; these functions run as the signed-in person, so
-- row level security still applies, and the composite foreign keys make sure
-- every class belongs to the same school.

create or replace function private.admission_key(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(lower(trim(p)), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g');
$$;

create or replace function public.import_students(
  p_school uuid,
  p_rows jsonb,                 -- [{admission_no, first_name, middle_name, last_name, gender, date_of_birth, class_arm_id, guardian_name, guardian_phone, guardian_email}]
  p_update_existing boolean     -- true: refresh students whose admission number already exists; false: leave them alone
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  r jsonb;
  v_student uuid;
  v_guardian uuid;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_guardians int := 0;
begin
  if not private.is_manager(p_school) then
    raise exception 'Only school managers can import students' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'Import between 1 and 5,000 students at a time' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    select id into v_student from public.students
    where school_id = p_school and admission_key = private.admission_key(r ->> 'admission_no');

    if v_student is null then
      insert into public.students (school_id, admission_no, first_name, middle_name, last_name, gender, date_of_birth, class_arm_id)
      values (
        p_school, r ->> 'admission_no', r ->> 'first_name', r ->> 'middle_name', r ->> 'last_name',
        (r ->> 'gender')::public.gender, (r ->> 'date_of_birth')::date, (r ->> 'class_arm_id')::uuid
      )
      returning id into v_student;
      v_created := v_created + 1;
    elsif p_update_existing then
      update public.students set
        first_name = r ->> 'first_name',
        middle_name = coalesce(r ->> 'middle_name', middle_name),
        last_name = r ->> 'last_name',
        gender = coalesce((r ->> 'gender')::public.gender, gender),
        date_of_birth = coalesce((r ->> 'date_of_birth')::date, date_of_birth),
        class_arm_id = coalesce((r ->> 'class_arm_id')::uuid, class_arm_id)
      where id = v_student;
      v_updated := v_updated + 1;
    else
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Parents: one record per phone number, shared by brothers and sisters.
    if r ->> 'guardian_name' is not null or r ->> 'guardian_phone' is not null then
      v_guardian := null;
      if r ->> 'guardian_phone' is not null then
        select id into v_guardian from public.guardians
        where school_id = p_school and phone = r ->> 'guardian_phone'
        order by created_at limit 1;
      end if;
      if v_guardian is null then
        insert into public.guardians (school_id, full_name, phone, email)
        values (p_school, coalesce(r ->> 'guardian_name', 'Parent of ' || (r ->> 'first_name')), r ->> 'guardian_phone', r ->> 'guardian_email')
        returning id into v_guardian;
        v_guardians := v_guardians + 1;
      end if;
      insert into public.student_guardians (school_id, student_id, guardian_id)
      values (p_school, v_student, v_guardian)
      on conflict do nothing;
    end if;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped, 'guardians', v_guardians);
end $$;

revoke all on function public.import_students(uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_students(uuid, jsonb, boolean) to authenticated;

create or replace function public.import_staff(
  p_school uuid,
  p_rows jsonb                  -- [{title, first_name, last_name, email, phone, position}]
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  r jsonb;
  v_created int := 0;
  v_skipped int := 0;
begin
  if not private.is_manager(p_school) then
    raise exception 'Only school managers can import staff' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Import between 1 and 1,000 staff at a time' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    -- The same email, or the same name and phone, means the person is already on the list.
    if exists (
      select 1 from public.staff s
      where s.school_id = p_school and (
        (r ->> 'email' is not null and lower(s.email) = lower(r ->> 'email'))
        or (lower(s.first_name) = lower(r ->> 'first_name') and lower(s.last_name) = lower(r ->> 'last_name')
            and coalesce(s.phone, '') = coalesce(r ->> 'phone', ''))
      )
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    insert into public.staff (school_id, title, first_name, last_name, email, phone, position)
    values (p_school, r ->> 'title', r ->> 'first_name', r ->> 'last_name', lower(r ->> 'email'), r ->> 'phone', r ->> 'position');
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end $$;

revoke all on function public.import_staff(uuid, jsonb) from public, anon;
grant execute on function public.import_staff(uuid, jsonb) to authenticated;

create index if not exists guardians_phone_idx on public.guardians (school_id, phone);
