-- DE-GLOBAL ACADEMY: private teacher signature assets
-- Apply only after reviewing the migration and confirming the matching frontend release.
-- Signatures remain private. Active users may read signatures only within their own school;
-- only active school administrators may create, replace or delete signature assets.

create table if not exists public.school_teacher_signatures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_name text not null check (length(btrim(subject_name)) between 1 and 160),
  storage_path text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint school_teacher_signatures_school_subject_key unique (school_id, subject_name),
  constraint school_teacher_signatures_storage_path_school check (
    split_part(storage_path, '/', 1) = school_id::text
    and split_part(storage_path, '/', 2) = 'signatures'
  )
);

create index if not exists school_teacher_signatures_school_idx
  on public.school_teacher_signatures (school_id);

alter table public.school_teacher_signatures enable row level security;

drop policy if exists school_teacher_signatures_school_select on public.school_teacher_signatures;
create policy school_teacher_signatures_school_select
on public.school_teacher_signatures for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and p.school_id = school_teacher_signatures.school_id
  )
);

drop policy if exists school_teacher_signatures_admin_insert on public.school_teacher_signatures;
create policy school_teacher_signatures_admin_insert
on public.school_teacher_signatures for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and p.school_id = school_teacher_signatures.school_id
      and lower(coalesce(p.role, '')) = 'administrator'
  )
);

drop policy if exists school_teacher_signatures_admin_update on public.school_teacher_signatures;
create policy school_teacher_signatures_admin_update
on public.school_teacher_signatures for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and p.school_id = school_teacher_signatures.school_id
      and lower(coalesce(p.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and p.school_id = school_teacher_signatures.school_id
      and lower(coalesce(p.role, '')) = 'administrator'
  )
);

drop policy if exists school_teacher_signatures_admin_delete on public.school_teacher_signatures;
create policy school_teacher_signatures_admin_delete
on public.school_teacher_signatures for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and p.school_id = school_teacher_signatures.school_id
      and lower(coalesce(p.role, '')) = 'administrator'
  )
);

grant select, insert, update, delete on public.school_teacher_signatures to authenticated;

-- Keep the existing administrator-only SELECT policy for other private assets.
-- This additional policy permits same-school active users to read signature objects only.
drop policy if exists school_private_signatures_school_select on storage.objects;
create policy school_private_signatures_school_select
on storage.objects for select to authenticated
using (
  bucket_id = 'school-private-assets'
  and (storage.foldername(name))[2] = 'signatures'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and p.school_id::text = (storage.foldername(name))[1]
  )
);

comment on table public.school_teacher_signatures is
  'Private Storage object references for school teacher signatures. Never store image data or public URLs here.';
