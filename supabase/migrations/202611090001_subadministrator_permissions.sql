create table if not exists public.profile_permission_grants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  is_active boolean not null default true,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint profile_permission_grants_unique unique (school_id, profile_id, permission_id),
  constraint profile_permission_grants_revocation_consistency check (
    (is_active = true and revoked_by is null and revoked_at is null)
    or (is_active = false and revoked_by is not null and revoked_at is not null)
  )
);
create index if not exists idx_profile_permission_grants_profile_active
  on public.profile_permission_grants (school_id, profile_id, permission_id) where is_active = true;

create table if not exists public.profile_permission_grant_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('granted','revoked')),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index if not exists idx_profile_permission_grant_audit_school_time
  on public.profile_permission_grant_audit (school_id, occurred_at desc);

create or replace function public.audit_profile_permission_grant_change()
returns trigger language plpgsql security invoker set search_path = public, pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profile_permission_grant_audit
      (school_id,target_profile_id,permission_id,actor_profile_id,action,details)
    values (new.school_id,new.profile_id,new.permission_id,new.granted_by,'granted',
      jsonb_build_object('grant_id',new.id,'is_active',new.is_active));
  elsif tg_op = 'UPDATE' and old.is_active is distinct from new.is_active then
    insert into public.profile_permission_grant_audit
      (school_id,target_profile_id,permission_id,actor_profile_id,action,details)
    values (new.school_id,new.profile_id,new.permission_id,
      case when new.is_active then new.granted_by else new.revoked_by end,
      case when new.is_active then 'granted' else 'revoked' end,
      jsonb_build_object('grant_id',new.id,'is_active',new.is_active));
  end if;
  return new;
end;
$$;
revoke all on function public.audit_profile_permission_grant_change() from public,anon,authenticated;
drop trigger if exists trg_audit_profile_permission_grant_change on public.profile_permission_grants;
create trigger trg_audit_profile_permission_grant_change after insert or update on public.profile_permission_grants
for each row execute function public.audit_profile_permission_grant_change();

create table if not exists public.sub_administrator_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id text, designation text, responsibilities text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint sub_administrator_details_staff_id_unique unique (school_id,staff_id)
);

alter table public.profile_permission_grants enable row level security;
alter table public.profile_permission_grant_audit enable row level security;
alter table public.sub_administrator_details enable row level security;
revoke all on public.profile_permission_grants,public.profile_permission_grant_audit,public.sub_administrator_details from anon,authenticated;
grant all on public.profile_permission_grants,public.profile_permission_grant_audit,public.sub_administrator_details to service_role;

create or replace function public.has_profile_permission(p_permission_key text)
returns boolean language sql stable security definer
set search_path = public, auth, pg_catalog as $$
  select exists (
    select 1 from public.profiles actor
    join public.profile_permission_grants grant_row on grant_row.profile_id=actor.id
      and grant_row.school_id=actor.school_id and grant_row.is_active=true
    join public.permissions permission_row on permission_row.id=grant_row.permission_id
    where actor.id=auth.uid() and actor.is_active=true
      and actor.role='sub_administrator' and permission_row.permission_key=p_permission_key
  );
$$;
revoke all on function public.has_profile_permission(text) from public,anon;
grant execute on function public.has_profile_permission(text) to authenticated;

drop policy if exists "Sub administrators can view school results" on public.results;
drop policy if exists "Sub administrators can view individually authorised results" on public.results;
create policy "Sub administrators can view individually authorised results" on public.results
for select to authenticated using (
  exists (select 1 from public.profiles actor where actor.id=auth.uid()
    and actor.school_id=results.school_id and actor.role='sub_administrator' and actor.is_active=true)
  and (public.has_profile_permission('view_results') or public.has_profile_permission('enter_results')
    or public.has_profile_permission('edit_results') or public.has_profile_permission('submit_results')
    or public.has_profile_permission('view_reports'))
);

drop policy if exists "Sub administrators can enter authorised draft results" on public.results;
create policy "Sub administrators can enter authorised draft results" on public.results
for insert to authenticated with check (
  status='draft' and entered_by=auth.uid()
  and exists (select 1 from public.profiles actor where actor.id=auth.uid()
    and actor.school_id=results.school_id and actor.role='sub_administrator' and actor.is_active=true)
  and public.has_profile_permission('enter_results')
  and exists (select 1 from public.students student join public.student_enrolments enrolment on enrolment.student_id=student.id
    where student.id=results.student_id and student.school_id=results.school_id
      and enrolment.school_id=results.school_id and enrolment.class_id=results.class_id
      and enrolment.academic_session_id=results.academic_session_id and enrolment.archived_at is null)
  and exists (select 1 from public.classes c where c.id=results.class_id and c.school_id=results.school_id)
  and exists (select 1 from public.subjects s where s.id=results.subject_id and s.school_id=results.school_id and s.is_active=true)
  and exists (select 1 from public.academic_sessions a where a.id=results.academic_session_id and a.school_id=results.school_id)
  and exists (select 1 from public.terms t where t.id=results.term_id and t.school_id=results.school_id)
);

drop policy if exists "Sub administrators can edit own draft results" on public.results;
create policy "Sub administrators can edit own draft results" on public.results
for update to authenticated using (
  entered_by=auth.uid() and status='draft'
  and exists (select 1 from public.profiles actor where actor.id=auth.uid()
    and actor.school_id=results.school_id and actor.role='sub_administrator' and actor.is_active=true)
  and public.has_profile_permission('edit_results')
) with check (
  entered_by=auth.uid() and status='draft'
  and exists (select 1 from public.profiles actor where actor.id=auth.uid()
    and actor.school_id=results.school_id and actor.role='sub_administrator' and actor.is_active=true)
  and public.has_profile_permission('edit_results')
);

drop policy if exists "Sub administrators can submit own draft results" on public.results;
create policy "Sub administrators can submit own draft results" on public.results
for update to authenticated using (
  entered_by=auth.uid() and status='draft'
  and exists (select 1 from public.profiles actor where actor.id=auth.uid()
    and actor.school_id=results.school_id and actor.role='sub_administrator' and actor.is_active=true)
  and public.has_profile_permission('submit_results')
) with check (
  entered_by=auth.uid() and status='submitted'
  and exists (select 1 from public.profiles actor where actor.id=auth.uid()
    and actor.school_id=results.school_id and actor.role='sub_administrator' and actor.is_active=true)
  and public.has_profile_permission('submit_results')
);
