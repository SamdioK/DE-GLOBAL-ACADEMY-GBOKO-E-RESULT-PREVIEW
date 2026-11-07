-- DE-GLOBAL ACADEMY GBOKO
-- Legacy storage migration — Phase 2 baseline audit
-- READ ONLY. Run in Supabase SQL Editor.
-- This script does not insert, update, delete, create, or alter anything.
--
-- School scope: the known DE-GLOBAL ACADEMY GBOKO school UUID.
-- If this UUID is not the school's current ID, STOP and confirm the correct ID.

-- RESULT 1: Confirm the school identity.
SELECT id, name
FROM public.schools
WHERE id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid;

-- RESULT 2: Existing record counts for the school.
-- Counts only; no student names, admission numbers, staff names or contact details.
SELECT 'classes' AS table_name, count(*)::bigint AS row_count
FROM public.classes WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'academic_sessions', count(*) FROM public.academic_sessions WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'terms', count(*) FROM public.terms WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'subjects', count(*) FROM public.subjects WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'students', count(*) FROM public.students WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'student_enrolments', count(*) FROM public.student_enrolments WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'student_passports', count(*) FROM public.student_passports WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'student_import_batches', count(*) FROM public.student_import_batches WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'student_import_rows', count(*) FROM public.student_import_rows WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'results', count(*) FROM public.results WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'assessment_configurations', count(*) FROM public.assessment_configurations WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'form_master_student_assessments', count(*) FROM public.form_master_student_assessments WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'form_master_assignments', count(*) FROM public.form_master_assignments WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'teacher_assignments', count(*) FROM public.teacher_assignments WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
UNION ALL
SELECT 'school_staff_directory', count(*) FROM public.school_staff_directory WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
ORDER BY table_name;

-- RESULT 3: Unique constraints and indexes on migration-sensitive tables.
-- These determine safe duplicate handling and upsert conflict targets.
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'students',
    'student_enrolments',
    'classes',
    'subjects',
    'student_passports',
    'results',
    'school_staff_directory'
  )
  AND indexdef ILIKE '%UNIQUE%'
ORDER BY tablename, indexname;

-- RESULT 4: Actual write policies for the principal migration destinations.
-- Missing INSERT/UPDATE policies may mean writes must use existing RPCs or Edge Functions.
SELECT
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'schools',
    'classes',
    'students',
    'student_enrolments',
    'student_passports',
    'subjects',
    'teacher_assignments',
    'results',
    'student_import_batches',
    'student_import_rows'
  )
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
ORDER BY tablename, cmd, policyname;

-- RESULT 5: Student enrolment and passport structural constraints.
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_schema = ccu.constraint_schema
 AND tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_schema = 'public'
  AND tc.table_name IN ('students', 'student_enrolments', 'student_passports')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
