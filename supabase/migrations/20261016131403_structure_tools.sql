-- Tools for schools to set up their own structure. Both functions run as the
-- signed-in person (security invoker), so row level security still applies,
-- and each runs as one transaction: it fully succeeds or changes nothing.

-- Adds a section (e.g. Junior Secondary) with its starter classes, arms,
-- subjects, CA/exam components and grading scale in one step.
create or replace function public.setup_section(
  p_school uuid,
  p_kind public.section_kind,
  p_name text,
  p_style public.assessment_style,
  p_levels text[],
  p_arms text[],
  p_subjects text[],
  p_electives jsonb default '{}'::jsonb,   -- {"Science": ["Biology", ...], ...}
  p_components jsonb default '[]'::jsonb,  -- [{"name": "CA 1", "maxScore": 20}, ...]
  p_scale_name text default null,
  p_scale jsonb default null               -- [{"min":70,"max":100,"grade":"A","remark":"Excellent"}, ...]
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_section uuid;
  v_level uuid;
  v_subject uuid;
  v_sort smallint := array_position(enum_range(null::public.section_kind), p_kind);
  v_lvl text;
  v_arm text;
  v_subj text;
  v_stream record;
  v_i int := 0;
  v_j int;
begin
  if not private.is_manager(p_school) then
    raise exception 'Only school managers can add sections' using errcode = '42501';
  end if;

  insert into public.sections (school_id, kind, name, assessment_style, sort_order)
  values (p_school, p_kind, p_name, p_style, v_sort)
  returning id into v_section;

  insert into public.assessment_components (school_id, section_id, name, max_score, sort_order)
  select p_school, v_section, c ->> 'name', (c ->> 'maxScore')::numeric, ord
  from jsonb_array_elements(p_components) with ordinality as t(c, ord);

  if p_scale is not null then
    insert into public.grading_scales (school_id, section_id, name, bands)
    values (p_school, v_section, coalesce(p_scale_name, 'Grading scale'), p_scale);
  end if;

  foreach v_lvl in array p_levels loop
    v_i := v_i + 1;
    insert into public.class_levels (school_id, section_id, name, sort_order)
    values (p_school, v_section, v_lvl, v_sort * 10 + v_i)
    returning id into v_level;

    foreach v_arm in array p_arms loop
      insert into public.class_arms (school_id, class_level_id, name) values (p_school, v_level, v_arm);
    end loop;

    v_j := 0;
    foreach v_subj in array p_subjects loop
      v_j := v_j + 1;
      insert into public.subjects (school_id, name) values (p_school, v_subj)
      on conflict (school_id, name) do update set is_active = true
      returning id into v_subject;
      insert into public.class_subjects (school_id, class_level_id, subject_id, sort_order)
      values (p_school, v_level, v_subject, v_j)
      on conflict do nothing;
    end loop;

    for v_stream in select key, value from jsonb_each(p_electives) loop
      for v_subj in select jsonb_array_elements_text(v_stream.value) loop
        v_j := v_j + 1;
        insert into public.subjects (school_id, name) values (p_school, v_subj)
        on conflict (school_id, name) do update set is_active = true
        returning id into v_subject;
        insert into public.class_subjects (school_id, class_level_id, subject_id, is_elective, stream, sort_order)
        values (p_school, v_level, v_subject, true, v_stream.key, v_j)
        on conflict do nothing;
      end loop;
    end loop;
  end loop;

  return v_section;
end $$;

revoke all on function public.setup_section(uuid, public.section_kind, text, public.assessment_style, text[], text[], text[], jsonb, jsonb, text, jsonb) from public, anon;
grant execute on function public.setup_section(uuid, public.section_kind, text, public.assessment_style, text[], text[], text[], jsonb, jsonb, text, jsonb) to authenticated;

-- Sets the current session and term (creating them if needed), so exactly one
-- of each is current for the school.
create or replace function public.set_current_term(
  p_school uuid,
  p_session text,
  p_term smallint,
  p_starts date,
  p_ends date,
  p_next date
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_session uuid;
  v_term uuid;
begin
  if not private.is_manager(p_school) then
    raise exception 'Only school managers can change the term' using errcode = '42501';
  end if;
  if p_term not between 1 and 3 then
    raise exception 'Term must be 1, 2 or 3' using errcode = '22023';
  end if;

  insert into public.academic_sessions (school_id, name) values (p_school, p_session)
  on conflict (school_id, name) do update set name = excluded.name
  returning id into v_session;

  update public.academic_sessions set is_current = false where school_id = p_school and is_current and id <> v_session;
  update public.academic_sessions set is_current = true where id = v_session;

  insert into public.terms (school_id, session_id, term_number, name, starts_on, ends_on, next_term_begins)
  values (p_school, v_session, p_term, (array['First term', 'Second term', 'Third term'])[p_term], p_starts, p_ends, p_next)
  on conflict (session_id, term_number) do update
    set starts_on = excluded.starts_on, ends_on = excluded.ends_on, next_term_begins = excluded.next_term_begins
  returning id into v_term;

  update public.terms set is_current = false where school_id = p_school and is_current and id <> v_term;
  update public.terms set is_current = true where id = v_term;

  return v_term;
end $$;

revoke all on function public.set_current_term(uuid, text, smallint, date, date, date) from public, anon;
grant execute on function public.set_current_term(uuid, text, smallint, date, date, date) to authenticated;
