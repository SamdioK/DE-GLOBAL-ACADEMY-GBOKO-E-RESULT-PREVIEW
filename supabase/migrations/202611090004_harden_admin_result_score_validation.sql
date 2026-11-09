CREATE OR REPLACE FUNCTION public.save_admin_student_result_batch(p_actor_id uuid, p_student_id uuid, p_class_id uuid, p_academic_session_id uuid, p_term_id uuid, p_scores jsonb, p_form_assessment jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor profiles%rowtype;
  v_class classes%rowtype;
  v_config assessment_configurations%rowtype;
  v_section text;
  v_can_enter boolean := false;
  v_can_edit boolean := false;
  v_item jsonb;
  v_subject_name text;
  v_subject_id uuid;
  v_subject_count integer;
  v_ca1 numeric;
  v_ca2 numeric;
  v_ca3 numeric;
  v_exam numeric;
  v_total numeric;
  v_grade text;
  v_remark text;
  v_existing results%rowtype;
  v_has_existing boolean;
  v_saved integer := 0;
  v_school_days integer;
  v_attendance integer;
  v_fees numeric;
  v_result_ids jsonb := '[]'::jsonb;
begin
  if p_actor_id is null or p_student_id is null or p_class_id is null or
     p_academic_session_id is null or p_term_id is null then
    raise exception 'Student, class, session, term and verified actor are required';
  end if;
  if jsonb_typeof(p_scores) <> 'array' or jsonb_array_length(p_scores) < 1 or jsonb_array_length(p_scores) > 60 then
    raise exception 'Provide between 1 and 60 subject score entries';
  end if;

  select * into v_actor from profiles where id = p_actor_id for share;
  if not found or v_actor.is_active is distinct from true or v_actor.school_id is null then
    raise exception 'The signed-in profile is not active';
  end if;
  if v_actor.role not in ('administrator','sub_administrator') then
    raise exception 'Only an Administrator or authorised Sub Administrator may enter subject results';
  end if;

  if v_actor.role = 'sub_administrator' then
    select
      coalesce(bool_or(pm.permission_key = 'enter_results'), false),
      coalesce(bool_or(pm.permission_key = 'edit_results'), false)
    into v_can_enter, v_can_edit
    from profile_permission_grants pg
    join permissions pm on pm.id = pg.permission_id
    where pg.school_id = v_actor.school_id
      and pg.profile_id = p_actor_id and pg.is_active = true;
    if not v_can_enter and not v_can_edit then
      raise exception 'Your account does not have permission to enter or edit results';
    end if;
  else
    v_can_enter := true;
    v_can_edit := true;
  end if;

  select * into v_class from classes
  where id = p_class_id and school_id = v_actor.school_id;
  if not found then raise exception 'The selected class does not belong to this school'; end if;
  v_section := case when upper(v_class.level) like 'BASIC%' then 'basic' else 'senior' end;

  if not exists (select 1 from academic_sessions
    where id = p_academic_session_id and school_id = v_actor.school_id) then
    raise exception 'The selected academic session does not belong to this school';
  end if;
  if not exists (select 1 from terms where id = p_term_id and school_id = v_actor.school_id) then
    raise exception 'The selected term does not belong to this school';
  end if;
  if not exists (select 1 from student_enrolments
    where school_id = v_actor.school_id and student_id = p_student_id
      and class_id = p_class_id and academic_session_id = p_academic_session_id
      and archived_at is null) then
    raise exception 'The student is not actively enrolled in the selected class and session';
  end if;
  if not exists (select 1 from students where id = p_student_id and school_id = v_actor.school_id) then
    raise exception 'The selected student does not belong to this school';
  end if;

  select * into v_config from assessment_configurations
  where school_id = v_actor.school_id
    and academic_session_id = p_academic_session_id
    and term_id = p_term_id and is_active = true
    and regexp_replace(upper(class_level), '[^A-Z0-9]', '', 'g') =
        regexp_replace(upper(v_class.level), '[^A-Z0-9]', '', 'g')
  limit 1;
  if not found then raise exception 'No active assessment configuration exists for this class level, session and term'; end if;

  for v_item in select value from jsonb_array_elements(p_scores)
  loop
    v_subject_name := btrim(coalesce(v_item->>'subject_name',''));
    if v_subject_name = '' then raise exception 'Every score entry must identify a subject'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_scores) x
      where lower(btrim(coalesce(x->>'subject_name',''))) = lower(v_subject_name)
      group by btrim(coalesce(x->>'subject_name','')) having count(*) > 1
    ) then raise exception 'Duplicate subject in score list: %', v_subject_name; end if;

    select count(*), min(id) into v_subject_count, v_subject_id
    from subjects
    where school_id = v_actor.school_id and is_active = true
      and section = v_section and lower(name) = lower(v_subject_name);
    if v_subject_count <> 1 then
      raise exception 'Subject "%" is not uniquely configured for the selected class section', v_subject_name;
    end if;

    begin
      v_ca1 := (v_item->>'ca1')::numeric;
      v_ca2 := (v_item->>'ca2')::numeric;
      v_ca3 := (v_item->>'ca3')::numeric;
      v_exam := (v_item->>'examination')::numeric;
    exception when others then
      raise exception 'Enter valid numeric scores for %', v_subject_name;
    end;
    if v_ca1 is null or v_ca2 is null or v_ca3 is null or v_exam is null then
      raise exception 'All four assessment fields are required for %', v_subject_name;
    end if;
    if v_ca1 < 0 or v_ca1 > v_config.ca1_max or
       v_ca2 < 0 or v_ca2 > v_config.ca2_max or
       v_ca3 < 0 or v_ca3 > v_config.ca3_max or
       v_exam < 0 or v_exam > v_config.examination_max then
      raise exception 'One or more scores for % exceed the configured assessment limits', v_subject_name;
    end if;
    v_total := v_ca1 + v_ca2 + v_ca3 + v_exam;
    if v_total > coalesce(v_config.total_max,100) then
      raise exception 'The total score for % exceeds the configured total maximum', v_subject_name;
    end if;

    select * into v_existing from results
    where student_id = p_student_id and subject_id = v_subject_id
      and academic_session_id = p_academic_session_id and term_id = p_term_id
    for update;
    v_has_existing := found;
    if v_has_existing then
      if v_existing.school_id <> v_actor.school_id or v_existing.class_id <> p_class_id then
        raise exception 'An existing result is linked to a different school or class';
      end if;
      if v_existing.status <> 'draft' then
        raise exception 'The % result is already submitted or published and cannot be overwritten', v_subject_name;
      end if;
      if v_actor.role = 'sub_administrator' and
         (not v_can_edit or v_existing.entered_by <> p_actor_id) then
        raise exception 'You may edit only your own draft results and must have the edit-results permission';
      end if;
    elsif v_actor.role = 'sub_administrator' and not v_can_enter then
      raise exception 'Your account does not have permission to enter new results';
    end if;

    if v_total >= 80 then v_grade := 'A'; v_remark := 'Excellent';
    elsif v_total >= 70 then v_grade := 'B'; v_remark := 'Very Good';
    elsif v_total >= 60 then v_grade := 'C'; v_remark := 'Good';
    elsif v_total >= 50 then v_grade := 'D'; v_remark := 'Fair';
    else v_grade := 'F'; v_remark := 'Poor'; end if;

    insert into results
      (school_id,student_id,class_id,subject_id,academic_session_id,term_id,
       ca1,ca2,ca3,examination,total,grade,remark,entered_by,status)
    values
      (v_actor.school_id,p_student_id,p_class_id,v_subject_id,p_academic_session_id,p_term_id,
       v_ca1,v_ca2,v_ca3,v_exam,v_total,v_grade,v_remark,p_actor_id,'draft')
    on conflict (student_id,subject_id,academic_session_id,term_id)
    do update set
      class_id = excluded.class_id, ca1 = excluded.ca1, ca2 = excluded.ca2,
      ca3 = excluded.ca3, examination = excluded.examination, total = excluded.total,
      grade = excluded.grade, remark = excluded.remark, updated_at = now()
    returning id into v_subject_id;
    v_saved := v_saved + 1;
    v_result_ids := v_result_ids || jsonb_build_array(jsonb_build_object('result_id',v_subject_id,'subject_name',v_subject_name,'total',v_total,'grade',v_grade));
  end loop;

  if p_form_assessment is not null and jsonb_typeof(p_form_assessment) = 'object' then
    v_school_days := coalesce(nullif(p_form_assessment->>'school_days','')::integer,60);
    v_attendance := nullif(p_form_assessment->>'attendance_days','')::integer;
    v_fees := nullif(p_form_assessment->>'next_term_fees','')::numeric;
    if v_school_days < 1 or (v_attendance is not null and (v_attendance < 0 or v_attendance > v_school_days)) then
      raise exception 'Attendance days must be between zero and the number of school days';
    end if;
    if v_fees is not null and v_fees < 0 then raise exception 'Next term fees cannot be negative'; end if;
    if p_form_assessment ? 'affective_ratings' and jsonb_typeof(p_form_assessment->'affective_ratings') <> 'object' then
      raise exception 'Affective ratings must be a JSON object';
    end if;
    if p_form_assessment ? 'psychomotor_ratings' and jsonb_typeof(p_form_assessment->'psychomotor_ratings') <> 'object' then
      raise exception 'Psychomotor ratings must be a JSON object';
    end if;
    insert into form_master_student_assessments
      (school_id,student_id,class_id,academic_session_id,term_id,affective_ratings,psychomotor_ratings,
       form_master_comment,attendance_days,school_days,next_term_fees,assessed_by)
    values
      (v_actor.school_id,p_student_id,p_class_id,p_academic_session_id,p_term_id,
       coalesce(p_form_assessment->'affective_ratings','{}'::jsonb),
       coalesce(p_form_assessment->'psychomotor_ratings','{}'::jsonb),
       nullif(btrim(p_form_assessment->>'form_master_comment'),''),
       v_attendance,v_school_days,v_fees,p_actor_id)
    on conflict (school_id,student_id,academic_session_id,term_id)
    do update set class_id=excluded.class_id, affective_ratings=excluded.affective_ratings,
      psychomotor_ratings=excluded.psychomotor_ratings, form_master_comment=excluded.form_master_comment,
      attendance_days=excluded.attendance_days, school_days=excluded.school_days,
      next_term_fees=excluded.next_term_fees, assessed_by=excluded.assessed_by, updated_at=now();
  end if;

  return jsonb_build_object('success',true,'saved_count',v_saved,'results',v_result_ids,'status','draft');
end;
$function$
