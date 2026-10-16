-- Saves a section's CA/exam components and grading scale in one transaction.
-- Runs as the signed-in person, so row level security still applies.
create or replace function public.save_grading(
  p_section uuid,
  p_components jsonb,  -- [{"id": uuid|null, "name": "CA 1", "maxScore": 20}, ...] in display order
  p_scale_name text,
  p_bands jsonb        -- [{"min":70,"max":100,"grade":"A","remark":"Excellent"}, ...]
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_school uuid;
  v_comp jsonb;
  v_i int := 0;
begin
  select school_id into v_school from public.sections where id = p_section;
  if v_school is null or not private.is_manager(v_school) then
    raise exception 'Only school managers can change grading' using errcode = '42501';
  end if;
  if jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) = 0 then
    raise exception 'Add at least one CA or exam' using errcode = '22023';
  end if;
  if (select sum((c ->> 'maxScore')::numeric) from jsonb_array_elements(p_components) c) <> 100 then
    raise exception 'CA and exam scores must add up to 100' using errcode = '22023';
  end if;

  delete from public.assessment_components
  where section_id = p_section
    and id not in (
      select (c ->> 'id')::uuid from jsonb_array_elements(p_components) c where c ->> 'id' is not null
    );

  -- Temporary names avoid clashes with the unique name rule while reordering or renaming.
  update public.assessment_components set name = '__tmp_' || id::text where section_id = p_section;

  for v_comp in select value from jsonb_array_elements(p_components) loop
    v_i := v_i + 1;
    if v_comp ->> 'id' is not null then
      update public.assessment_components
      set name = v_comp ->> 'name', max_score = (v_comp ->> 'maxScore')::numeric, sort_order = v_i
      where id = (v_comp ->> 'id')::uuid and section_id = p_section;
    else
      insert into public.assessment_components (school_id, section_id, name, max_score, sort_order)
      values (v_school, p_section, v_comp ->> 'name', (v_comp ->> 'maxScore')::numeric, v_i);
    end if;
  end loop;

  insert into public.grading_scales (school_id, section_id, name, bands)
  values (v_school, p_section, coalesce(p_scale_name, 'Grading scale'), p_bands)
  on conflict (section_id) do update set name = excluded.name, bands = excluded.bands;
end $$;

revoke all on function public.save_grading(uuid, jsonb, text, jsonb) from public, anon;
grant execute on function public.save_grading(uuid, jsonb, text, jsonb) to authenticated;
