-- DE-GLOBAL ACADEMY GBOKO
-- Legacy Storage Migration — Phase 4A
-- School identity and academic context: read-only validation
--
-- Run each labelled RESULT separately in Supabase SQL Editor if needed.
-- This file contains SELECT statements only. It does not write or migrate data.
-- Expected legacy schoolInfo values from the preserved snapshot:
--   name    = DE-GLOBAL ACADEMY GBOKO
--   address = Gboko
--   email   = empty string
--   phone   = empty string
--   session = 2026/2027
-- Logo is empty. Signature and stamp fields are data URLs and are deliberately
-- excluded from this relational comparison.
--
-- Confirm the project and school UUID before proceeding.

-- RESULT 1: Current school record.
SELECT
    id,
    name,
    address,
    phone,
    email,
    logo_url,
    motto,
    created_at,
    updated_at
FROM public.schools
WHERE id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid;

-- RESULT 2: Academic sessions for this school.
-- Compare the legacy schoolInfo.session value with the session name.
SELECT
    id,
    school_id,
    name,
    start_date,
    end_date,
    is_current,
    created_at
FROM public.academic_sessions
WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
ORDER BY start_date NULLS LAST, name;

-- RESULT 3: Terms for this school.
-- The legacy schoolInfo object does not define term identity or current term.
SELECT
    id,
    school_id,
    name,
    term_number,
    is_current,
    created_at
FROM public.terms
WHERE school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
ORDER BY term_number, name;

-- RESULT 4: Actual destination columns and data types.
-- This prevents assumptions about fields that are not present in the schema.
SELECT
    table_name,
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('schools', 'academic_sessions', 'terms')
ORDER BY table_name, ordinal_position;

-- RESULT 5: RLS state and policies for the three destination tables.
-- Policy expressions are included for review; this query does not change them.
SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd AS policy_command,
    p.qual AS using_expression,
    p.with_check AS check_expression
FROM pg_class c
JOIN pg_namespace n
    ON n.oid = c.relnamespace
LEFT JOIN pg_policies p
    ON p.schemaname = n.nspname
   AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('schools', 'academic_sessions', 'terms')
ORDER BY c.relname, p.policyname NULLS FIRST;
