create or replace function public.save_result_assessment_stage_scores(p_class_id uuid,p_subject_id uuid,p_academic_session_id uuid,p_term_id uuid,p_assessment_stage smallint,p_entries jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_actor public.profiles%rowtype; v_class public.classes%rowtype; v_config public.assessment_configurations%rowtype;
 v_field text; v_max numeric; v_item jsonb; v_student uuid; v_score numeric; v_absence boolean;
 v_count integer; v_expected integer; v_seen uuid[]:='{}'; v_saved integer:=0; v_existing_status text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_actor from public.profiles where id=auth.uid() and is_active=true;
 if not found or v_actor.school_id is null or v_actor.role<>'subject_teacher' then raise exception 'An active Subject Teacher account is required'; end if;
 if p_assessment_stage not between 1 and 4 then raise exception 'Assessment stage must be 1 to 4'; end if;
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)=0 then raise exception 'Provide the complete class-arm student score list'; end if;
 select * into v_class from public.classes where id=p_class_id and school_id=v_actor.school_id;
 if not found then raise exception 'Class arm not found'; end if;
 if not exists(select 1 from public.teacher_assignments a where a.school_id=v_actor.school_id and a.teacher_id=auth.uid() and a.class_id=p_class_id and a.subject_id=p_subject_id and a.academic_session_id=p_academic_session_id and a.term_id=p_term_id and a.is_active=true) then raise exception 'You are not assigned to this subject and class arm'; end if;
 select * into v_config from public.assessment_configurations c where c.school_id=v_actor.school_id and c.academic_session_id=p_academic_session_id and c.term_id=p_term_id and c.is_active=true and regexp_replace(upper(c.class_level),'[^A-Z0-9]','','g')=regexp_replace(upper(v_class.level),'[^A-Z0-9]','','g') limit 1;
 if not found then raise exception 'No active assessment configuration exists for this class and term'; end if;
 v_field:=case p_assessment_stage when 1 then 'ca1' when 2 then 'ca2' when 3 then 'ca3' else 'examination' end;
 v_max:=case p_assessment_stage when 1 then v_config.ca1_max when 2 then v_config.ca2_max when 3 then v_config.ca3_max else v_config.examination_max end;
 select count(*) into v_expected from public.student_enrolments e where e.school_id=v_actor.school_id and e.class_id=p_class_id and e.academic_session_id=p_academic_session_id and e.archived_at is null;
 if jsonb_array_length(p_entries)<>v_expected then raise exception 'Submit exactly one entry for each of the % active students in this class arm',v_expected; end if;
 for v_item in select value from jsonb_array_elements(p_entries) loop
  begin v_student:=(v_item->>'student_id')::uuid; exception when others then raise exception 'Every score entry must contain a valid student_id'; end;
  if v_student=any(v_seen) then raise exception 'Duplicate student in score list'; end if; v_seen:=array_append(v_seen,v_student);
  if not exists(select 1 from public.student_enrolments e where e.school_id=v_actor.school_id and e.student_id=v_student and e.class_id=p_class_id and e.academic_session_id=p_academic_session_id and e.archived_at is null) then raise exception 'A submitted student is not actively enrolled in this class arm'; end if;
  v_absence:=coalesce(v_item->>'score','')='-';
  if v_absence then v_score:=null; else
   if coalesce(v_item->>'score','')='' then raise exception 'Blank score entries are not allowed; use - only for confirmed non-participation'; end if;
   begin v_score:=(v_item->>'score')::numeric; exception when others then raise exception 'Scores must be numeric or a single hyphen'; end;
   if v_score<0 or v_score>v_max then raise exception 'Score for student % must be between 0 and %',v_student,v_max; end if;
  end if;
  select status into v_existing_status from public.results where school_id=v_actor.school_id and student_id=v_student and class_id=p_class_id and subject_id=p_subject_id and academic_session_id=p_academic_session_id and term_id=p_term_id;
  if v_existing_status is not null and v_existing_status<>'draft' then raise exception 'A non-draft result cannot be edited by the Subject Teacher'; end if;
  if exists(select 1 from public.result_assessment_submissions s where s.school_id=v_actor.school_id and s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_session_id=p_academic_session_id and s.term_id=p_term_id and s.assessment_stage=p_assessment_stage and s.status not in ('draft','returned_to_teacher','returned_by_admin')) then raise exception 'This assessment stage has been submitted and is locked for editing'; end if;
  if p_assessment_stage=1 then
   update public.results set ca1=v_score,ca1_entered=true,ca1_not_participated=v_absence,updated_at=now() where school_id=v_actor.school_id and student_id=v_student and class_id=p_class_id and subject_id=p_subject_id and academic_session_id=p_academic_session_id and term_id=p_term_id;
  elsif p_assessment_stage=2 then
   update public.results set ca2=v_score,ca2_entered=true,ca2_not_participated=v_absence,updated_at=now() where school_id=v_actor.school_id and student_id=v_student and class_id=p_class_id and subject_id=p_subject_id and academic_session_id=p_academic_session_id and term_id=p_term_id;
  elsif p_assessment_stage=3 then
   update public.results set ca3=v_score,ca3_entered=true,ca3_not_participated=v_absence,updated_at=now() where school_id=v_actor.school_id and student_id=v_student and class_id=p_class_id and subject_id=p_subject_id and academic_session_id=p_academic_session_id and term_id=p_term_id;
  else
   update public.results set examination=v_score,examination_entered=true,examination_not_participated=v_absence,updated_at=now() where school_id=v_actor.school_id and student_id=v_student and class_id=p_class_id and subject_id=p_subject_id and academic_session_id=p_academic_session_id and term_id=p_term_id;
  end if;
  get diagnostics v_count=row_count;
  if v_count=0 then
   insert into public.results(school_id,student_id,class_id,subject_id,academic_session_id,term_id,ca1,ca2,ca3,examination,entered_by,status,ca1_entered,ca2_entered,ca3_entered,examination_entered,ca1_not_participated,ca2_not_participated,ca3_not_participated,examination_not_participated)
   values(v_actor.school_id,v_student,p_class_id,p_subject_id,p_academic_session_id,p_term_id,case when p_assessment_stage=1 then v_score else 0 end,case when p_assessment_stage=2 then v_score else 0 end,case when p_assessment_stage=3 then v_score else 0 end,case when p_assessment_stage=4 then v_score else 0 end,auth.uid(),'draft',p_assessment_stage=1,p_assessment_stage=2,p_assessment_stage=3,p_assessment_stage=4,p_assessment_stage=1 and v_absence,p_assessment_stage=2 and v_absence,p_assessment_stage=3 and v_absence,p_assessment_stage=4 and v_absence);
  end if;
  v_saved:=v_saved+1;
 end loop;
 return jsonb_build_object('success',true,'saved_count',v_saved,'assessment_stage',p_assessment_stage,'non_participation_count',(select count(*) from jsonb_array_elements(p_entries) x where x->>'score'='-'));
end $$;
revoke all on function public.save_result_assessment_stage_scores(uuid,uuid,uuid,uuid,smallint,jsonb) from public,anon;
grant execute on function public.save_result_assessment_stage_scores(uuid,uuid,uuid,uuid,smallint,jsonb) to authenticated;