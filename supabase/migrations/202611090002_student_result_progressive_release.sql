-- Progressive result release is independent of result approval/publication status.
create table if not exists public.student_result_release_stages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  release_stage smallint not null default 0 check (release_stage between 0 and 4),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint student_result_release_stages_scope_unique unique (school_id,student_id,academic_session_id,term_id)
);
create table if not exists public.student_result_release_stage_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  old_stage smallint not null check (old_stage between 0 and 4),
  new_stage smallint not null check (new_stage between 0 and 4),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create or replace function public.audit_student_result_release_stage()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.student_result_release_stage_audit
      (school_id,student_id,academic_session_id,term_id,old_stage,new_stage,changed_by)
    values (new.school_id,new.student_id,new.academic_session_id,new.term_id,0,new.release_stage,new.updated_by);
    return new;
  end if;
  if old.release_stage is distinct from new.release_stage then
    insert into public.student_result_release_stage_audit
      (school_id,student_id,academic_session_id,term_id,old_stage,new_stage,changed_by)
    values (new.school_id,new.student_id,new.academic_session_id,new.term_id,old.release_stage,new.release_stage,new.updated_by);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_audit_student_result_release_stage on public.student_result_release_stages;
create trigger trg_audit_student_result_release_stage after insert or update of release_stage
on public.student_result_release_stages for each row execute function public.audit_student_result_release_stage();
alter table public.student_result_release_stages enable row level security;
alter table public.student_result_release_stage_audit enable row level security;
revoke all on public.student_result_release_stages from anon, authenticated;
revoke all on public.student_result_release_stage_audit from anon, authenticated;
grant all on public.student_result_release_stages to service_role;
grant all on public.student_result_release_stage_audit to service_role;
revoke all on function public.audit_student_result_release_stage() from public, anon, authenticated;
