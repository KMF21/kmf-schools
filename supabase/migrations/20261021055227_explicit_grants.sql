-- From 30 October 2026, Supabase no longer grants API access to new tables in
-- "public" automatically. Every table's access is written out here, so a fresh
-- copy of the database (a test project, a preview branch) works the same as live.
-- Row level security still decides which rows each person can see or change.
--
-- Rule for new tables: grant access in the same migration that creates them.

do $$
declare
  t text;
begin
  foreach t in array array[
    'academic_sessions', 'announcements', 'assessment_components', 'billing_plans', 'class_arms',
    'class_levels', 'class_subjects', 'grading_scales', 'guardians', 'invoices', 'platform_admins',
    'promotion_runs', 'ratings', 'report_traits', 'result_releases', 'school_domains', 'school_members',
    'schools', 'scores', 'sections', 'staff', 'student_guardians', 'students', 'subjects',
    'teaching_assignments', 'term_reports', 'terms'
  ] loop
    -- Signed-out visitors read nothing directly; they use resolve_school and find_schools.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- The one exception: public announcements shown on the school's pages.
grant select on public.announcements to anon;
