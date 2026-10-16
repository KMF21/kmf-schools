-- Fixes from the Supabase security and performance advisors.
--
-- Note: public.resolve_school is intentionally callable without signing in.
-- It returns only a school's public branding (name, motto, colours, contact),
-- which every visitor needs before the login page can show the right school.

-- 1. Fixed search path for the trigger helper.
alter function private.touch_updated_at() set search_path = '';

-- 2. Indexes for every foreign key, so lookups and deletes stay fast as schools grow.
create index if not exists announcements_created_by_idx on public.announcements (created_by);
create index if not exists assessment_components_section_idx on public.assessment_components (section_id, school_id);
create index if not exists class_arms_level_idx on public.class_arms (class_level_id, school_id);
create index if not exists class_arms_form_teacher_idx on public.class_arms (form_teacher_id, school_id);
create index if not exists class_levels_section_idx on public.class_levels (section_id, school_id);
create index if not exists class_subjects_level_idx on public.class_subjects (class_level_id, school_id);
create index if not exists class_subjects_subject_idx on public.class_subjects (subject_id, school_id);
create index if not exists grading_scales_section_idx on public.grading_scales (section_id, school_id);
create index if not exists guardians_school_idx on public.guardians (school_id);
create index if not exists staff_user_idx on public.staff (user_id);
create index if not exists student_guardians_guardian_school_idx on public.student_guardians (guardian_id, school_id);
create index if not exists student_guardians_student_school_idx on public.student_guardians (student_id, school_id);
create index if not exists students_class_school_idx on public.students (class_arm_id, school_id);
create index if not exists teaching_assignments_arm_idx on public.teaching_assignments (class_arm_id, school_id);
create index if not exists teaching_assignments_staff_school_idx on public.teaching_assignments (staff_id, school_id);
create index if not exists teaching_assignments_subject_idx on public.teaching_assignments (subject_id, school_id);
create index if not exists terms_session_idx on public.terms (session_id, school_id);

-- 3. One permissive policy per action. "Manage" policies no longer also cover
--    SELECT, because each table's read policy already lets managers read
--    (is_member, is_staff and is_manager all include managers and KMF admins).
do $$
declare
  t text;
  manage_policy text;
begin
  foreach t in array array[
    'academic_sessions', 'terms', 'sections', 'class_levels', 'class_arms', 'subjects',
    'class_subjects', 'grading_scales', 'assessment_components',
    'staff', 'students', 'guardians', 'student_guardians', 'announcements', 'teaching_assignments'
  ] loop
    manage_policy := case t when 'teaching_assignments' then 'teaching_manage' else t || '_manage' end;
    execute format('drop policy %I on public.%I', manage_policy, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_manager(school_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_manager(school_id)) with check (private.is_manager(school_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_manager(school_id))', t || '_delete', t);
  end loop;
end $$;

-- Schools: members (incl. KMF admins) read, managers (incl. KMF admins) update,
-- only KMF admins create or delete.
drop policy schools_platform on public.schools;
create policy schools_insert on public.schools for insert to authenticated with check (private.is_platform_admin());
create policy schools_delete on public.schools for delete to authenticated using (private.is_platform_admin());

-- Domains: managers (incl. KMF admins) read; only KMF admins change them.
drop policy domains_platform on public.school_domains;
create policy domains_insert on public.school_domains for insert to authenticated with check (private.is_platform_admin());
create policy domains_update on public.school_domains for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy domains_delete on public.school_domains for delete to authenticated using (private.is_platform_admin());
