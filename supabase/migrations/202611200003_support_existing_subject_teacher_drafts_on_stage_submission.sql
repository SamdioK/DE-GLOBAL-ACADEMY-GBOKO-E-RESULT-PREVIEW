create or replace function public.submit_result_assessment_stage(
  p_class_id uuid,p_subject_id uuid,p_academic_session_id uuid,p_term_id uuid,p_assessment_stage smallint
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
 v_actor public.profiles%rowtype; v_class public.classes%rowtype; v_submission public.result_assessment_submissions%rowtype;
 v_form_master uuid; v_enrolment_count integer; v_result_count integer; v_missing integer; v_status text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_actor from public.profiles where id=auth.uid() and is_active=true for share;
 if not found or v_actor.school_id is null then raise exception 'Active school profile required'; end if;
 if p_assessment_stage not between 1 and 4 then raise exception 'Assessment stage must be 1 to 4'; end if;
 select * into v_class from public.classes where id=p_class_id and school_id=v_actor.school_id;
 if not found then raise exception 'Class arm not found'; end if;
 if not exists(select 1 from public.subjects where id=p_subject_id and school_id=v_actor.school_id and is_active=true) then raise exception 'Active subject not found'; end if;
 if not exists(select 1 from public.academic_sessions where id=p_academic_session_id and school_id=v_actor.school_id) then raise exception 'Academic session not found'; end if;
 if not exists(select 1 from public.terms where id=p_term_id and school_id=v_actor.school_id) then raise exception 'Term not found'; end if;
 if v_actor.role<>'subject_teacher' or not exists(select 1 from public.teacher_assignments a where a.school_id=v_actor.school_id and a.teacher_id=auth.uid() and a.class_id=p_class_id and a.subject_id=p_subject_id and a.academic_session_id=p_academic_session_id and a.term_id=p_term_id and a.is_active=true) then raise exception 'You are not actively assigned to this class arm and subject for the selected session and term'; end if;
 if p_assessment_stage>1 and not exists(select 1 from public.result_assessment_submissions s where s.school_id=v_actor.school_id and s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_session_id=p_academic_session_id and s.term_id=p_term_id and s.assessment_stage=p_assessment_stage-1 and s.status='approved') then raise exception 'The preceding assessment stage must receive final Administrator approval first'; end if;
 select f.teacher_id into v_form_master from public.form_master_assignments f where f.school_id=v_actor.school_id and f.class_id=p_class_id and f.academic_session_id=p_academic_session_id order by f.created_at desc limit 1;
 if v_form_master is null then raise exception 'No Form Master is assigned to this class arm and session'; end if;
 select count(*) into v_enrolment_count from public.student_enrolments e where e.school_id=v_actor.school_id and e.class_id=p_class_id and e.academic_session_id=p_academic_session_id and e.archived_at is null;
 if v_enrolment_count=0 then raise exception 'No active students are enrolled in this class arm'; end if;
 select count(*) into v_result_count from public.results r join public.student_enrolments e on e.student_id=r.student_id and e.school_id=r.school_id and e.class_id=r.class_id and e.academic_session_id=r.academic_session_id and e.archived_at is null where r.school_id=v_actor.school_id and r.class_id=p_class_id and r.subject_id=p_subject_id and r.academic_session_id=p_academic_session_id and r.term_id=p_term_id;
 if v_result_count<>v_enrolment_count then raise exception 'Every active student must have a subject result row before submission'; end if;
 -- Existing Save as Draft writes non-NULL scores to results. Mark those values as entered;
 -- NULL remains missing and therefore cannot pass the submission check.
 if p_assessment_stage=1 then
  update public.results r set ca1_entered=true from public.student_enrolments e where e.student_id=r.student_id and e.school_id=r.school_id and e.class_id=r.class_id and e.academic_session_id=r.academic_session_id and e.archived_at is null and r.school_id=v_actor.school_id and r.class_id=p_class_id and r.subject_id=p_subject_id and r.academic_session_id=p_academic_session_id and r.term_id=p_term_id and r.status='draft' and r.ca1 is not null and not r.ca1_entered;
 elsif p_assessment_stage=2 then
  update public.results r set ca2_entered=true from public.student_enrolments e where e.student_id=r.student_id and e.school_id=r.school_id and e.class_id=r.class_id and e.academic_session_id=r.academic_session_id and e.archived_at is null and r.school_id=v_actor.school_id and r.class_id=p_class_id and r.subject_id=p_subject_id and r.academic_session_id=p_academic_session_id and r.term_id=p_term_id and r.status='draft' and r.ca2 is not null and not r.ca2_entered;
 elsif p_assessment_stage=3 then
  update public.results r set ca3_entered=true from public.student_enrolments e where e.student_id=r.student_id and e.school_id=r.school_id and e.class_id=r.class_id and e.academic_session_id=r.academic_session_id and e.archived_at is null and r.school_id=v_actor.school_id and r.class_id=p_class_id and r.subject_id=p_subject_id and r.academic_session_id=p_academic_session_id and r.term_id=p_term_id and r.status='draft' and r.ca3 is not null and not r.ca3_entered;
 else
  update public.results r set examination_entered=true from public.student_enrolments e where e.student_id=r.student_id and e.school_id=r.school_id and e.class_id=r.class_id and e.academic_session_id=r.academic_session_id and e.archived_at is null and r.school_id=v_actor.school_id and r.class_id=p_class_id and r.subject_id=p_subject_id and r.academic_session_id=p_academic_session_id and r.term_id=p_term_id and r.status='draft' and r.examination is not null and not r.examination_entered;
 end if;
 select count(*) into v_missing from public.results r join public.student_enrolments e on e.student_id=r.student_id and e.school_id=r.school_id and e.class_id=r.class_id and e.academic_session_id=r.academic_session_id and e.archived_at is null where r.school_id=v_actor.school_id and r.class_id=p_class_id and r.subject_id=p_subject_id and r.academic_session_id=p_academic_session_id and r.term_id=p_term_id and r.status='draft' and case p_assessment_stage when 1 then not r.ca1_entered or (r.ca1_not_participated and r.ca1 is not null) when 2 then not r.ca2_entered or (r.ca2_not_participated and r.ca2 is not null) when 3 then not r.ca3_entered or (r.ca3_not_participated and r.ca3 is not null) when 4 then not r.examination_entered or (r.examination_not_participated and r.examination is not null) end;
 if v_missing>0 then raise exception '% student entries are blank or contain an invalid non-participation marker',v_missing; end if;
 select * into v_submission from public.result_assessment_submissions where school_id=v_actor.school_id and class_id=p_class_id and subject_id=p_subject_id and academic_session_id=p_academic_session_id and term_id=p_term_id and assessment_stage=p_assessment_stage for update;
 if found and v_submission.status not in ('draft','returned_to_teacher','returned_by_admin') then raise exception 'This assessment stage has already been submitted and is locked'; end if;
 if found then
  update public.result_assessment_submissions set status='submitted_to_form_master',submitted_by=auth.uid(),submitted_at=now(),form_master_id=v_form_master,form_master_action_by=null,form_master_action_at=null,form_master_comment=null,admin_action_by=null,admin_action_at=null,admin_comment=null,updated_at=now() where id=v_submission.id;
  v_status:=v_submission.status;
 else
  insert into public.result_assessment_submissions(school_id,class_id,subject_id,academic_session_id,term_id,assessment_stage,status,submitted_by,submitted_at,form_master_id) values(v_actor.school_id,p_class_id,p_subject_id,p_academic_session_id,p_term_id,p_assessment_stage,'submitted_to_form_master',auth.uid(),now(),v_form_master) returning * into v_submission;
  v_status:='draft';
 end if;
 insert into public.result_assessment_submission_audit(submission_id,school_id,actor_id,action,from_status,to_status) values(v_submission.id,v_actor.school_id,auth.uid(),'teacher_submit',v_status,'submitted_to_form_master');
 return jsonb_build_object('success',true,'submission_id',v_submission.id,'status','submitted_to_form_master','student_count',v_enrolment_count,'assessment_stage',p_assessment_stage);
end $function$;
revoke all on function public.submit_result_assessment_stage(uuid,uuid,uuid,uuid,smallint) from public,anon;
grant execute on function public.submit_result_assessment_stage(uuid,uuid,uuid,uuid,smallint) to authenticated;