-- Only KMF can change a school's status (live, setting up, suspended) or its web
-- name. Proprietors and school admins can still edit everything else about their
-- school. Without this, a suspended school's admin could switch itself back on.
create or replace function private.guard_school_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.status is distinct from old.status or new.slug is distinct from old.slug)
     and current_user in ('authenticated', 'anon')
     and not private.is_platform_admin() then
    raise exception 'Only KMF can change a school''s status or web name' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_school_fields() from public;

create trigger schools_guard
  before update on public.schools
  for each row execute function private.guard_school_fields();
