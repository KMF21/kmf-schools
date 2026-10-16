-- Public bucket for school branding: logos, principal signatures, stamps, website photos.
-- Files live under <school_id>/..., and only that school's managers can change them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-assets', 'school-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy school_assets_manage on storage.objects for all to authenticated
  using (
    bucket_id = 'school-assets'
    and private.is_manager(nullif((storage.foldername(name))[1], '')::uuid)
  )
  with check (
    bucket_id = 'school-assets'
    and private.is_manager(nullif((storage.foldername(name))[1], '')::uuid)
  );
