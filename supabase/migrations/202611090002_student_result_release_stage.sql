-- Progressive result visibility is separate from result approval/publication.
create table if not exists public.student_result_release_stages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  release_stage smallint not null default 0 check (release_stage between 0 and 4),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_id, academic_session_id, term_id)
);
create index if not exists idx_student_result_release_scope
  on public.student_result_release_stages (school_id, academic_session_id, term_id, release_stage);
alter table public.student_result_release_stages enable row level security;
revoke all on public.student_result_release_stages from anon, authenticated;
grant all on public.student_result_release_stages to service_role;

create table if not exists public.student_result_release_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  previous_stage smallint not null check (previous_stage between 0 and 4),
  new_stage smallint not null check (new_stage between 0 and 4),
  action text not null check (action in ('created','advanced','reduced','reset')),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index if not exists idx_student_result_release_audit_scope
  on public.student_result_release_audit (school_id, student_id, academic_session_id, term_id, occurred_at desc);
alter table public.student_result_release_audit enable row level security;
revoke all on public.student_result_release_audit from anon, authenticated;
grant all on public.student_result_release_audit to service_role;

create or replace function public.audit_student_result_release_stage()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_previous smallint := 0; v_action text; v_actor uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'created'; v_actor := new.updated_by;
  else
    v_previous := old.release_stage; v_actor := coalesce(new.updated_by, old.updated_by, new.created_by);
    if new.release_stage > old.release_stage then v_action := 'advanced';
    elsif new.release_stage < old.release_stage and new.release_stage = 0 then v_action := 'reset';
    else v_action := 'reduced'; end if;
  end if;
  if v_actor is null then raise exception 'A verified actor is required to change result release stages'; end if;
  insert into public.student_result_release_audit
    (school_id, student_id, academic_session_id, term_id, previous_stage, new_stage, action, actor_profile_id)
  values (new.school_id, new.student_id, new.academic_session_id, new.term_id, v_previous, new.release_stage, v_action, v_actor);
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.audit_student_result_release_stage() from public, anon, authenticated;
drop trigger if exists trg_audit_student_result_release_stage on public.student_result_release_stages;
create trigger trg_audit_student_result_release_stage
before insert or update of release_stage on public.student_result_release_stages
for each row execute function public.audit_student_result_release_stage();
