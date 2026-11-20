-- Assessment-stage submission foundation
-- Adds explicit entered/absence markers and a class-arm + subject + stage approval record.
-- Existing results are preserved; legacy rows remain unmarked until their scores are reviewed.

alter table public.results
  add column if not exists ca1_entered boolean not null default false,
  add column if not exists ca2_entered boolean not null default false,
  add column if not exists ca3_entered boolean not null default false,
  add column if not exists examination_entered boolean not null default false,
  add column if not exists ca1_not_participated boolean not null default false,
  add column if not exists ca2_not_participated boolean not null default false,
  add column if not exists ca3_not_participated boolean not null default false,
  add column if not exists examination_not_participated boolean not null default false;

create table if not exists public.result_assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  assessment_stage smallint not null check (assessment_stage between 1 and 4),
  status text not null default 'draft'
    check (status in ('draft','submitted_to_form_master','returned_to_teacher','approved_by_form_master','submitted_to_admin','returned_by_admin','approved')),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  form_master_id uuid references public.profiles(id),
  form_master_action_by uuid references public.profiles(id),
  form_master_action_at timestamptz,
  form_master_comment text,
  admin_action_by uuid references public.profiles(id),
  admin_action_at timestamptz,
  admin_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,class_id,subject_id,academic_session_id,term_id,assessment_stage)
);

create table if not exists public.result_assessment_submission_audit (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.result_assessment_submissions(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  from_status text,
  to_status text,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists result_assessment_submissions_queue_idx
  on public.result_assessment_submissions(school_id,status,assessment_stage,class_id);
create index if not exists result_assessment_submissions_scope_idx
  on public.result_assessment_submissions(school_id,academic_session_id,term_id,class_id,subject_id);

alter table public.result_assessment_submissions enable row level security;
alter table public.result_assessment_submission_audit enable row level security;

drop policy if exists result_assessment_submissions_school_read on public.result_assessment_submissions;
create policy result_assessment_submissions_school_read
on public.result_assessment_submissions for select to authenticated
using (school_id = (select p.school_id from public.profiles p where p.id = (select auth.uid()) and p.is_active = true));

drop policy if exists result_assessment_submission_audit_school_read on public.result_assessment_submission_audit;
create policy result_assessment_submission_audit_school_read
on public.result_assessment_submission_audit for select to authenticated
using (school_id = (select p.school_id from public.profiles p where p.id = (select auth.uid()) and p.is_active = true));

revoke insert, update, delete on public.result_assessment_submissions from anon, authenticated;
revoke insert, update, delete on public.result_assessment_submission_audit from anon, authenticated;

create or replace function public.enforce_assessment_submission_score_lock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage smallint;
  v_locked boolean;
begin
  if tg_op <> 'UPDATE' then return new; end if;

  for v_stage in 1..4 loop
    select exists (
      select 1 from public.result_assessment_submissions s
      where s.school_id = old.school_id
        and s.class_id = old.class_id
        and s.subject_id = old.subject_id
        and s.academic_session_id = old.academic_session_id
        and s.term_id = old.term_id
        and s.assessment_stage = v_stage
        and s.status not in ('draft','returned_to_teacher','returned_by_admin')
    ) into v_locked;

    if v_locked then
      if (v_stage = 1 and (
            new.ca1 is distinct from old.ca1 or
            new.ca1_entered is distinct from old.ca1_entered or
            new.ca1_not_participated is distinct from old.ca1_not_participated
          )) or
         (v_stage = 2 and (
            new.ca2 is distinct from old.ca2 or
            new.ca2_entered is distinct from old.ca2_entered or
            new.ca2_not_participated is distinct from old.ca2_not_participated
          )) or
         (v_stage = 3 and (
            new.ca3 is distinct from old.ca3 or
            new.ca3_entered is distinct from old.ca3_entered or
            new.ca3_not_participated is distinct from old.ca3_not_participated
          )) or
         (v_stage = 4 and (
            new.examination is distinct from old.examination or
            new.examination_entered is distinct from old.examination_entered or
            new.examination_not_participated is distinct from old.examination_not_participated
          )) then
        raise exception 'Assessment stage % is locked after submission. An authorised return or audited administrator correction is required.', v_stage;
      end if;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists enforce_assessment_submission_score_lock_trigger on public.results;
create trigger enforce_assessment_submission_score_lock_trigger
before update on public.results
for each row execute function public.enforce_assessment_submission_score_lock();

revoke all on function public.enforce_assessment_submission_score_lock() from public, anon, authenticated;
