-- DE-GLOBAL ACADEMY GBOKO
-- Phase 5C: Restrict class, student, enrolment and assignment tables to
-- authenticated SELECT access. All authorised writes must use approved
-- server-side workflows (Edge Functions/RPCs) or a separately reviewed policy.
--
-- IMPORTANT:
-- 1. This migration changes database permissions; it does not change data.
-- 2. Run only after reviewing the Phase 5C migration manual.
-- 3. It intentionally does not revoke service_role privileges.
-- 4. Existing RLS SELECT policies remain in place and continue to enforce
--    school scoping. RLS is not disabled or bypassed.
-- 5. Authenticated direct INSERT/UPDATE/DELETE on these five tables will stop.

BEGIN;

-- Remove table-level grants, including any broad grants to anon/authenticated.
REVOKE ALL PRIVILEGES ON TABLE
  public.classes,
  public.form_master_assignments,
  public.teacher_assignments,
  public.students,
  public.student_enrolments
FROM anon, authenticated;

-- Remove column-level grants as well. Table-level REVOKE does not remove
-- independently granted column privileges.
REVOKE ALL PRIVILEGES (
  id, school_id, level, arm, class_name, created_at
) ON TABLE public.classes FROM anon, authenticated;

REVOKE ALL PRIVILEGES (
  id, school_id, teacher_id, class_id, academic_session_id, created_at
) ON TABLE public.form_master_assignments FROM anon, authenticated;

REVOKE ALL PRIVILEGES (
  id, school_id, teacher_id, class_id, subject_id, academic_session_id,
  created_at, is_active
) ON TABLE public.teacher_assignments FROM anon, authenticated;

REVOKE ALL PRIVILEGES (
  id, school_id, profile_id, admission_number, first_name, middle_name,
  last_name, gender, date_of_birth, guardian_name, guardian_phone,
  guardian_email, status, created_at, updated_at, login_status,
  login_created_at, login_error, student_house
) ON TABLE public.students FROM anon, authenticated;

REVOKE ALL PRIVILEGES (
  id, school_id, student_id, academic_session_id, class_id, created_at,
  register_number, sid, archived_at, archived_by, replacement_request_id
) ON TABLE public.student_enrolments FROM anon, authenticated;

-- Restore only the read permission required by the current application.
GRANT SELECT ON TABLE
  public.classes,
  public.form_master_assignments,
  public.teacher_assignments,
  public.students,
  public.student_enrolments
TO authenticated;

COMMIT;
