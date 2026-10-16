-- Demo school for development and sales demos: Brightfield Academy, Jalingo (fictional).
-- Reachable at brightfield.localhost:3000 locally, or brightfield.<your platform domain>.

do $$
declare
  v_school uuid := '00000000-0000-4000-8000-000000000001';
  v_session uuid;
  v_section uuid;
  v_level uuid;
  v_subject uuid;
  v_sort int;
  r record;
  lvl text;
  subj text;
begin
  insert into public.schools (id, slug, name, short_name, motto, address, phone, email, brand_color, status)
  values (v_school, 'brightfield', 'Brightfield Academy', 'Brightfield', 'Light, learning, character',
          '12 Hospital Road, Jalingo, Taraba State', '+234 800 000 0000', 'info@brightfield.example',
          '#1a8754', 'active')
  on conflict (id) do nothing;

  insert into public.academic_sessions (school_id, name, starts_on, ends_on, is_current)
  values (v_school, '2026/2027', '2026-09-14', '2027-07-23', true)
  returning id into v_session;

  insert into public.terms (school_id, session_id, term_number, name, starts_on, ends_on, next_term_begins, is_current)
  values
    (v_school, v_session, 1, 'First term', '2026-09-14', '2026-12-11', '2027-01-11', true),
    (v_school, v_session, 2, 'Second term', '2027-01-11', '2027-04-02', '2027-04-26', false),
    (v_school, v_session, 3, 'Third term', '2027-04-26', '2027-07-23', null, false);

  for r in
    select * from (values
      ('nursery'::public.section_kind, 'Nursery', 'rating'::public.assessment_style, 1,
        array['Nursery 1', 'Nursery 2'],
        array['Language and Literacy', 'Numeracy', 'Social Habits', 'Creative Arts']),
      ('primary', 'Primary', 'score', 2,
        array['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
        array['English Studies', 'Mathematics', 'Basic Science and Technology', 'Social and Citizenship Studies', 'Christian Religious Studies', 'Cultural and Creative Arts', 'Computer Studies']),
      ('junior_secondary', 'Junior Secondary', 'score', 3,
        array['JSS 1', 'JSS 2', 'JSS 3'],
        array['English Studies', 'Mathematics', 'Basic Science', 'Basic Technology', 'Social Studies', 'Civic Education', 'Business Studies', 'Computer Studies']),
      ('senior_secondary', 'Senior Secondary', 'score', 4,
        array['SS 1', 'SS 2', 'SS 3'],
        array['English Language', 'Mathematics', 'Civic Education', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government'])
    ) as t(kind, name, style, sort, levels, subjects)
  loop
    insert into public.sections (school_id, kind, name, assessment_style, sort_order)
    values (v_school, r.kind, r.name, r.style, r.sort)
    returning id into v_section;

    if r.style = 'score' then
      insert into public.assessment_components (school_id, section_id, name, max_score, sort_order)
      values (v_school, v_section, 'CA 1', 20, 1), (v_school, v_section, 'CA 2', 20, 2), (v_school, v_section, 'Exam', 60, 3);

      -- Same defaults as WAEC_SCALE and BASIC_SCALE in packages/core/src/curriculum.ts
      insert into public.grading_scales (school_id, section_id, name, bands)
      values (v_school, v_section,
        case when r.kind = 'senior_secondary' then 'WAEC scale' else 'Standard scale' end,
        case when r.kind = 'senior_secondary' then
          '[{"min":75,"max":100,"grade":"A1","remark":"Excellent"},{"min":70,"max":74,"grade":"B2","remark":"Very good"},{"min":65,"max":69,"grade":"B3","remark":"Good"},{"min":60,"max":64,"grade":"C4","remark":"Credit"},{"min":55,"max":59,"grade":"C5","remark":"Credit"},{"min":50,"max":54,"grade":"C6","remark":"Credit"},{"min":45,"max":49,"grade":"D7","remark":"Pass"},{"min":40,"max":44,"grade":"E8","remark":"Pass"},{"min":0,"max":39,"grade":"F9","remark":"Fail"}]'::jsonb
        else
          '[{"min":70,"max":100,"grade":"A","remark":"Excellent"},{"min":60,"max":69,"grade":"B","remark":"Very good"},{"min":50,"max":59,"grade":"C","remark":"Good"},{"min":45,"max":49,"grade":"D","remark":"Fair"},{"min":40,"max":44,"grade":"E","remark":"Pass"},{"min":0,"max":39,"grade":"F","remark":"Fail"}]'::jsonb
        end);
    end if;

    v_sort := 0;
    foreach lvl in array r.levels loop
      v_sort := v_sort + 1;
      insert into public.class_levels (school_id, section_id, name, sort_order)
      values (v_school, v_section, lvl, r.sort * 10 + v_sort)
      returning id into v_level;

      insert into public.class_arms (school_id, class_level_id, name) values (v_school, v_level, 'A');
      if r.kind in ('junior_secondary', 'senior_secondary') then
        insert into public.class_arms (school_id, class_level_id, name) values (v_school, v_level, 'B');
      end if;

      foreach subj in array r.subjects loop
        insert into public.subjects (school_id, name) values (v_school, subj)
        on conflict (school_id, name) do update set name = excluded.name
        returning id into v_subject;
        insert into public.class_subjects (school_id, class_level_id, subject_id) values (v_school, v_level, v_subject);
      end loop;
    end loop;
  end loop;

  insert into public.announcements (school_id, title, body, audience, published_at)
  values
    (v_school, 'First term mid-term break', 'School closes Thursday 29 October and resumes Monday 2 November.', 'everyone', now()),
    (v_school, 'Inter-house sports', 'Parents are welcome to the inter-house sports on Saturday 21 November at 9am.', 'public', now());
end $$;
