-- DE-GLOBAL ACADEMY GBOKO
-- Phase 5C: Read-only class and enrolment schema/security audit
-- Run in Supabase SQL Editor. This script performs SELECTs only.
-- Do not add writes or alter the returned results.

-- 1. Relevant table existence, RLS and FORCE RLS.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'classes',
    'form_master_assignments',
    'teacher_assignments',
    'students',
    'student_enrolments'
  )
ORDER BY c.relname;

-- 2. Actual columns, types, nullability and defaults.
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'classes',
    'form_master_assignments',
    'teacher_assignments',
    'students',
    'student_enrolments'
  )
ORDER BY table_name, ordinal_position;

-- 3. Table-level privileges for anon, authenticated and PUBLIC.
SELECT
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'classes',
    'form_master_assignments',
    'teacher_assignments',
    'students',
    'student_enrolments'
  )
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 4. Column-level privileges for anon and authenticated.
SELECT
  table_name,
  column_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'classes',
    'form_master_assignments',
    'teacher_assignments',
    'students',
    'student_enrolments'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, column_name, privilege_type;

-- 5. RLS policies and their expressions.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'classes',
    'form_master_assignments',
    'teacher_assignments',
    'students',
    'student_enrolments'
  )
ORDER BY tablename, policyname;

-- 6. Foreign keys, including referenced table and columns.
SELECT
  child.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class child ON child.oid = con.conrelid
JOIN pg_namespace n ON n.oid = child.relnamespace
WHERE n.nspname = 'public'
  AND con.contype = 'f'
  AND child.relname IN (
    'classes',
    'form_master_assignments',
    'teacher_assignments',
    'students',
    'student_enrolments'
  )
ORDER BY child.relname, con.conname;

-- 7. Unique and non-unique indexes relevant to identity and assignment integrity.
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'classes',
    'form_master_assignments',
    'teacher_assignments',
    'students',
    'student_enrolments'
  )
ORDER BY tablename, indexname;
