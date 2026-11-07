-- DE-GLOBAL ACADEMY GBOKO
-- Phase 2C — Student login readiness audit
-- READ ONLY: SELECT statements only. No account is created or changed.
-- School UUID: b135a823-0a04-4b4b-86dd-2b20ea5e9fac
--
-- Purpose: quantify account-link and login-status readiness before any
-- administrator decides whether additional student accounts are required.
-- This audit does not return names, admission numbers, passwords or contacts.

-- RESULT 1 — Student counts grouped by student status, login status and
-- whether a profile link exists.
SELECT
  COALESCE(NULLIF(trim(st.status), ''), '(blank)') AS student_status,
  COALESCE(NULLIF(trim(st.login_status), ''), '(blank)') AS login_status,
  CASE WHEN st.profile_id IS NULL THEN 'no_profile_link' ELSE 'profile_linked' END AS profile_link_state,
  count(*)::bigint AS student_count
FROM public.students st
WHERE st.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- RESULT 2 — Account eligibility counts, without exposing admission numbers.
-- A valid admission number here means nonblank and not the known PENDING-
-- placeholder pattern used by the application. Server-side provisioning
-- remains authoritative and may apply additional checks.
SELECT
  st.status AS student_status,
  CASE
    WHEN st.admission_number IS NULL OR trim(st.admission_number) = '' THEN 'missing_admission_number'
    WHEN st.admission_number ~* '^PENDING-' THEN 'pending_placeholder'
    ELSE 'has_nonblank_admission_number'
  END AS admission_number_state,
  CASE WHEN st.profile_id IS NULL THEN 'no_profile_link' ELSE 'profile_linked' END AS profile_link_state,
  count(*)::bigint AS student_count
FROM public.students st
WHERE st.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- RESULT 3 — Role and active-state summary for linked profiles only.
-- This detects unexpected links without revealing profile identities.
SELECT
  lower(COALESCE(NULLIF(trim(p.role), ''), '(blank)')) AS linked_profile_role,
  p.is_active AS linked_profile_is_active,
  p.must_change_password,
  count(*)::bigint AS linked_student_count
FROM public.students st
JOIN public.profiles p ON p.id = st.profile_id
WHERE st.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- RESULT 4 — Check whether one profile is linked to multiple student rows.
-- Normally zero rows; this is a structural check, not a repair.
SELECT
  st.profile_id,
  count(*)::bigint AS linked_student_count,
  array_agg(st.id ORDER BY st.id) AS student_ids
FROM public.students st
WHERE st.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
  AND st.profile_id IS NOT NULL
GROUP BY st.profile_id
HAVING count(*) > 1
ORDER BY st.profile_id;
