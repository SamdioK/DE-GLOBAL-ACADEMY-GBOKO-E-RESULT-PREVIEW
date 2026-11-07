-- DE-GLOBAL ACADEMY GBOKO
-- Legacy Storage Migration — Phase 3B Read-only Reconciliation
-- Run each section in Supabase SQL Editor and return the result sets.
-- STRICTLY READ ONLY: no INSERT, UPDATE, DELETE, DDL, RPC or Storage operation.
-- School UUID: b135a823-0a04-4b4b-86dd-2b20ea5e9fac
-- Source: private browser backup reviewed on 2026-11-07.
--
-- This audit compares captured legacy configuration with existing rows.
-- It does not authorise any migration or change.

-- RESULT 1: Confirm school identity before reviewing any other result.
SELECT id, name
FROM public.schools
WHERE id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid;

-- RESULT 2: Match the 30 captured legacy class names against Supabase classes.
WITH legacy_classes(class_name) AS (
  VALUES
    ('BASIC7A'), ('BASIC7B'), ('BASIC7C'), ('BASIC7D'), ('BASIC7E'),
    ('BASIC8A'), ('BASIC8B'), ('BASIC8C'), ('BASIC8D'), ('BASIC8E'),
    ('BASIC9A'), ('BASIC9B'), ('BASIC9C'), ('BASIC9D'), ('BASIC9E'),
    ('SS1A'), ('SS1B'), ('SS1C'), ('SS1D'), ('SS1E'),
    ('SS2A'), ('SS2B'), ('SS2C'), ('SS2D'), ('SS2E'),
    ('SS3A'), ('SS3B'), ('SS3C'), ('SS3D'), ('SS3E')
),
matches AS (
  SELECT
    l.class_name AS legacy_class_name,
    count(c.id)::integer AS matching_supabase_rows,
    string_agg(c.id::text, ', ' ORDER BY c.id) AS supabase_class_ids
  FROM legacy_classes l
  LEFT JOIN public.classes c
    ON c.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
   AND lower(trim(c.class_name)) = lower(trim(l.class_name))
  GROUP BY l.class_name
)
SELECT
  legacy_class_name,
  matching_supabase_rows,
  CASE
    WHEN matching_supabase_rows = 0 THEN 'NO MATCH'
    WHEN matching_supabase_rows = 1 THEN 'ONE MATCH'
    ELSE 'DUPLICATE MATCHES'
  END AS reconciliation_status,
  supabase_class_ids
FROM matches
ORDER BY legacy_class_name;

-- RESULT 3: Show Supabase class rows and detect duplicate normalised class names.
SELECT
  lower(trim(class_name)) AS normalised_class_name,
  count(*)::integer AS row_count,
  string_agg(id::text, ', ' ORDER BY id) AS class_ids
FROM public.classes
WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
GROUP BY lower(trim(class_name))
ORDER BY normalised_class_name;

-- RESULT 4: Compare the six class levels represented in the legacy assessment
-- configuration with the current Supabase assessment configuration rows.
-- The legacy snapshot has 30 classes across six levels, all with 10/10/10/70.
-- This query shows actual Supabase session, term, maxima and active state.
WITH legacy_levels(class_level, legacy_ca1, legacy_ca2, legacy_ca3, legacy_exam) AS (
  VALUES
    ('BASIC7', 10::numeric, 10::numeric, 10::numeric, 70::numeric),
    ('BASIC8', 10::numeric, 10::numeric, 10::numeric, 70::numeric),
    ('BASIC9', 10::numeric, 10::numeric, 10::numeric, 70::numeric),
    ('SS1',    10::numeric, 10::numeric, 10::numeric, 70::numeric),
    ('SS2',    10::numeric, 10::numeric, 10::numeric, 70::numeric),
    ('SS3',    10::numeric, 10::numeric, 10::numeric, 70::numeric)
)
SELECT
  l.class_level AS legacy_class_level,
  l.legacy_ca1,
  l.legacy_ca2,
  l.legacy_ca3,
  l.legacy_exam,
  ac.id AS supabase_configuration_id,
  ac.class_level AS supabase_class_level,
  s.name AS academic_session,
  t.name AS term,
  ac.ca1_max,
  ac.ca2_max,
  ac.ca3_max,
  ac.examination_max,
  ac.total_max,
  ac.is_active
FROM legacy_levels l
LEFT JOIN public.assessment_configurations ac
  ON ac.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
 AND lower(trim(ac.class_level)) = lower(trim(l.class_level))
LEFT JOIN public.academic_sessions s ON s.id = ac.academic_session_id
LEFT JOIN public.terms t ON t.id = ac.term_id
ORDER BY l.class_level, s.name, t.name, ac.id;

-- RESULT 5: Inspect the existing school-scoped teacher assignment(s).
-- IDs and class/subject/session labels only; no teacher names or contact details.
SELECT
  ta.id AS assignment_id,
  ta.teacher_id,
  ta.class_id,
  c.class_name,
  ta.subject_id,
  sub.name AS subject_name,
  ta.academic_session_id,
  s.name AS academic_session,
  ta.is_active
FROM public.teacher_assignments ta
LEFT JOIN public.classes c ON c.id = ta.class_id
LEFT JOIN public.subjects sub ON sub.id = ta.subject_id
LEFT JOIN public.academic_sessions s ON s.id = ta.academic_session_id
WHERE ta.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
ORDER BY c.class_name, sub.name, ta.id;

-- RESULT 6: Staff-directory aggregate only; no names, emails or phone numbers.
SELECT
  count(*)::bigint AS staff_directory_rows,
  count(profile_id)::bigint AS rows_linked_to_profiles,
  count(NULLIF(trim(staff_id), ''))::bigint AS rows_with_staff_id,
  count(NULLIF(trim(email), ''))::bigint AS rows_with_email
FROM public.school_staff_directory
WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid;

-- RESULT 7: Staff-directory column inventory for future field-level mapping.
-- Metadata only; no staff record values are returned.
SELECT
  ordinal_position,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'school_staff_directory'
ORDER BY ordinal_position;

-- SAFETY:
-- Do not run any INSERT/UPDATE/DELETE based on these results.
-- A matching count is not proof of record identity.
-- Do not infer teacher UUIDs from names or email addresses.
-- Do not migrate legacy class passwords, student slots, browser licence data,
-- developer profile data, base64 images or student records from this script.
