-- DE-GLOBAL ACADEMY: segregated school asset buckets
-- Apply only after reviewing the migration and confirming the application release.
-- Public bucket: approved school logos/staff photos/news images only.
-- Private bucket: signatures, internal documents and other restricted assets.
-- Student passports remain in the existing private student-passports bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('school-public-assets', 'school-public-assets', true, 5242880,
   array['image/jpeg','image/png','image/webp']),
  ('school-private-assets', 'school-private-assets', false, 10485760,
   array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Never silently change an existing bucket's visibility or upload restrictions.
do $
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'school-public-assets'
      and public is true
      and file_size_limit = 5242880
      and allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
  ) then
    raise exception 'school-public-assets already exists with unexpected settings; review it manually.';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'school-private-assets'
      and public is false
      and file_size_limit = 10485760
      and allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']::text[]
  ) then
    raise exception 'school-private-assets already exists with unexpected settings; review it manually.';
  end if;
end
$;

drop policy if exists school_public_assets_admin_insert on storage.objects;
create policy school_public_assets_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'school-public-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists school_public_assets_admin_update on storage.objects;
create policy school_public_assets_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'school-public-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'school-public-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists school_public_assets_admin_delete on storage.objects;
create policy school_public_assets_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'school-public-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists school_private_assets_admin_select on storage.objects;
create policy school_private_assets_admin_select
on storage.objects for select to authenticated
using (
  bucket_id = 'school-private-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists school_private_assets_admin_insert on storage.objects;
create policy school_private_assets_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'school-private-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists school_private_assets_admin_update on storage.objects;
create policy school_private_assets_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'school-private-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'school-private-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists school_private_assets_admin_delete on storage.objects;
create policy school_private_assets_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'school-private-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and lower(coalesce(p.role, '')) = 'administrator'
      and p.school_id::text = (storage.foldername(name))[1]
  )
);
