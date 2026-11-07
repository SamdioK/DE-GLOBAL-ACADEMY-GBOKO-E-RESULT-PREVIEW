-- DE-GLOBAL ACADEMY GBOKO
-- Legacy browser-storage migration — Phase 2B data-integrity reconciliation
-- READ ONLY: SELECT statements only. Run in Supabase SQL Editor.
-- No records, policies, tables, indexes, or storage objects are changed.
--
-- School: DE-GLOBAL ACADEMY GBOKO
-- School UUID: b135a823-0a04-4b4b-86dd-2b20ea5e9fac
--
-- IMPORTANT:
-- 1. Run as an authorised database operator.
-- 2. Review every result set. A non-zero count is a review item, not automatic
--    permission to delete, merge, archive, or overwrite a record.
-- 3. This audit intentionally returns identifiers and counts, not names,
--    admission numbers, guardian contacts, or staff personal details.

-- RESULT 1 — School identity and baseline counts.
SELECT
  s.id AS school_id,
  s.name AS school_name,
  (SELECT count(*) FROM public.students st WHERE st.school_id = s.id) AS students,
  (SELECT count(*) FROM public.student_enrolments e WHERE e.school_id = s.id) AS enrolments,
  (SELECT count(*) FROM public.student_enrolments e WHERE e.school_id = s.id AND e.archived_at IS NULL) AS active_enrolments,
  (SELECT count(*) FROM public.student_passports p WHERE p.school_id = s.id) AS passports
FROM public.schools s
WHERE s.id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid;

-- RESULT 2 — Active students with no active enrolment.
-- A student may be intentionally inactive or awaiting placement; review status
-- and source records before deciding what to do.
SELECT
  st.id AS student_id,
  st.status AS student_status,
  st.login_status,
  st.profile_id
FROM public.students st
WHERE st.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND st.status <> 'archived'
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_enrolments e
    WHERE e.school_id = st.school_id
      AND e.student_id = st.id
      AND e.archived_at IS NULL
  )
ORDER BY st.id;

-- RESULT 3 — Active enrolments whose student, class, or session is missing
-- or belongs to a different school. Foreign keys should prevent missing
-- referenced rows, but this also checks school-scope consistency.
SELECT
  e.id AS enrolment_id,
  e.student_id,
  e.class_id,
  e.academic_session_id,
  e.school_id AS enrolment_school_id,
  st.school_id AS student_school_id,
  c.school_id AS class_school_id,
  a.school_id AS session_school_id
FROM public.student_enrolments e
LEFT JOIN public.students st ON st.id = e.student_id
LEFT JOIN public.classes c ON c.id = e.class_id
LEFT JOIN public.academic_sessions a ON a.id = e.academic_session_id
WHERE e.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND e.archived_at IS NULL
  AND (
    st.id IS NULL OR c.id IS NULL OR a.id IS NULL
    OR st.school_id IS DISTINCT FROM e.school_id
    OR c.school_id IS DISTINCT FROM e.school_id
    OR a.school_id IS DISTINCT FROM e.school_id
  )
ORDER BY e.id;

-- RESULT 4 — Duplicate active enrolments for the same student and session.
-- The partial unique index should prevent these. This query independently
-- verifies the data state.
SELECT
  e.student_id,
  e.academic_session_id,
  count(*) AS active_enrolment_count,
  array_agg(e.id ORDER BY e.id) AS enrolment_ids
FROM public.student_enrolments e
WHERE e.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND e.archived_at IS NULL
GROUP BY e.student_id, e.academic_session_id
HAVING count(*) > 1
ORDER BY e.student_id, e.academic_session_id;

-- RESULT 5 — Duplicate active admission numbers after trimming and
-- case-folding. The existing unique index may be case-sensitive, so this
-- stricter check catches values that could collide during normalisation.
-- Admission numbers are not displayed; only student IDs and counts are.
SELECT
  lower(trim(st.admission_number)) AS normalised_admission_key,
  count(*) AS matching_student_count,
  array_agg(st.id ORDER BY st.id) AS student_ids
FROM public.students st
WHERE st.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND st.status <> 'archived'
  AND st.admission_number IS NOT NULL
  AND trim(st.admission_number) <> ''
GROUP BY lower(trim(st.admission_number))
HAVING count(*) > 1
ORDER BY matching_student_count DESC;

-- RESULT 6 — Passport rows with inconsistent school/student ownership,
-- missing updater profile, or blank storage path. This does not test whether
-- the object exists in the private Storage bucket.
SELECT
  p.id AS passport_id,
  p.student_id,
  p.updated_by,
  CASE
    WHEN st.id IS NULL THEN 'student_missing'
    WHEN st.school_id IS DISTINCT FROM p.school_id THEN 'student_school_mismatch'
    WHEN pr.id IS NULL THEN 'updater_profile_missing'
    WHEN pr.school_id IS DISTINCT FROM p.school_id THEN 'updater_school_mismatch'
    WHEN p.storage_path IS NULL OR trim(p.storage_path) = '' THEN 'storage_path_blank'
    ELSE 'review'
  END AS review_reason
FROM public.student_passports p
LEFT JOIN public.students st ON st.id = p.student_id
LEFT JOIN public.profiles pr ON pr.id = p.updated_by
WHERE p.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND (
    st.id IS NULL
    OR st.school_id IS DISTINCT FROM p.school_id
    OR pr.id IS NULL
    OR pr.school_id IS DISTINCT FROM p.school_id
    OR p.storage_path IS NULL
    OR trim(p.storage_path) = ''
  )
ORDER BY p.id;

-- RESULT 7 — Student profile-link review. A missing profile can be valid for
-- students who do not have portal accounts; this is informational, not an
-- instruction to create accounts.
SELECT
  st.id AS student_id,
  st.profile_id,
  CASE
    WHEN st.profile_id IS NULL THEN 'no_profile_link'
    WHEN pr.id IS NULL THEN 'profile_missing'
    WHEN pr.school_id IS DISTINCT FROM st.school_id THEN 'profile_school_mismatch'
    ELSE 'linked'
  END AS profile_link_status
FROM public.students st
LEFT JOIN public.profiles pr ON pr.id = st.profile_id
WHERE st.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND (
    st.profile_id IS NULL
    OR pr.id IS NULL
    OR pr.school_id IS DISTINCT FROM st.school_id
  )
ORDER BY st.id;

-- RESULT 8 — Enrolment register-number and SID review.
-- Blank/null values are reported separately from duplicate values. Archived
-- enrolments are excluded from active duplicate checks.
SELECT
  'active_enrolment_missing_register_number' AS issue,
  count(*) AS row_count
FROM public.student_enrolments e
WHERE e.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND e.archived_at IS NULL
  AND e.register_number IS NULL
UNION ALL
SELECT
  'active_enrolment_missing_sid',
  count(*)
FROM public.student_enrolments e
WHERE e.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND e.archived_at IS NULL
  AND (e.sid IS NULL OR trim(e.sid) = '')
ORDER BY issue;

-- RESULT 9 — Cross-check class and academic-session references for all
-- active enrolments, summarised by class/session pair.
SELECT
  e.class_id,
  e.academic_session_id,
  count(*) AS active_enrolment_count,
  count(*) FILTER (WHERE st.id IS NULL) AS missing_student_count,
  count(*) FILTER (WHERE c.id IS NULL) AS missing_class_count,
  count(*) FILTER (WHERE a.id IS NULL) AS missing_session_count
FROM public.student_enrolments e
LEFT JOIN public.students st ON st.id = e.student_id
LEFT JOIN public.classes c ON c.id = e.class_id
LEFT JOIN public.academic_sessions a ON a.id = e.academic_session_id
WHERE e.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND e.archived_at IS NULL
GROUP BY e.class_id, e.academic_session_id
ORDER BY e.class_id, e.academic_session_id;
