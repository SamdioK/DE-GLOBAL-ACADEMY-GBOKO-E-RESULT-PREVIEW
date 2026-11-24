-- Permit active school Principals to view (never modify) their school's
-- registered student passport rows and corresponding private Storage objects.
drop policy if exists "principal_read_school_student_passports" on public.student_passports;
create policy "principal_read_school_student_passports"
on public.student_passports
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = student_passports.school_id
      and lower(coalesce(p.role, '')) = 'principal'
      and p.is_active is true
  )
);

drop policy if exists "principal_read_school_student_passport_files" on storage.objects;
create policy "principal_read_school_student_passport_files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-passports'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id::text = (storage.foldername(objects.name))[1]
      and lower(coalesce(p.role, '')) = 'principal'
      and p.is_active is true
  )
);
