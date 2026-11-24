-- Add independently delegable Student Passport Registration access for Sub Administrators.
insert into public.permissions (permission_key, permission_name)
values ('manage_student_passports', 'Student Passport Registration')
on conflict (permission_key) do update
set permission_name = excluded.permission_name;

-- Passport rows remain scoped to the Sub Administrator's own school and the explicit grant.
drop policy if exists "subadmin_manage_school_student_passports" on public.student_passports;
create policy "subadmin_manage_school_student_passports"
on public.student_passports
for all
to authenticated
using (
  public.has_profile_permission('manage_student_passports')
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = student_passports.school_id
      and p.role = 'sub_administrator'
      and p.is_active is true
  )
)
with check (
  public.has_profile_permission('manage_student_passports')
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = student_passports.school_id
      and p.role = 'sub_administrator'
      and p.is_active is true
  )
);

-- Keep private passport objects restricted to the same school and explicit permission.
drop policy if exists "subadmin_manage_school_student_passport_files" on storage.objects;
create policy "subadmin_manage_school_student_passport_files"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'student-passports'
  and public.has_profile_permission('manage_student_passports')
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id::text = (storage.foldername(objects.name))[1]
      and p.role = 'sub_administrator'
      and p.is_active is true
  )
)
with check (
  bucket_id = 'student-passports'
  and public.has_profile_permission('manage_student_passports')
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id::text = (storage.foldername(objects.name))[1]
      and p.role = 'sub_administrator'
      and p.is_active is true
  )
);
