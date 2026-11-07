-- DE-GLOBAL ACADEMY GBOKO
-- Phase 4B: Administrator authorisation and school-profile write-path inspection
-- READ-ONLY ONLY. Run each RESULT section separately in Supabase SQL Editor.
-- No DDL, DML, RPC calls, policy changes, or Storage operations are performed.

-- RESULT 1: Existing policies for identity, roles and school-profile tables.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'profile_roles', 'permissions',
                    'role_permissions', 'schools', 'academic_sessions', 'terms')
ORDER BY tablename, policyname;

-- RESULT 2: Role and permission table columns (metadata only).
SELECT table_name, ordinal_position, column_name, data_type, is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'profile_roles', 'permissions', 'role_permissions')
ORDER BY table_name, ordinal_position;

-- RESULT 3: Existing database helper functions that may enforce administrator,
-- role, permission, or school-membership checks. Function source is metadata/code,
-- not user records. Review SECURITY DEFINER and configured search_path carefully.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS return_type,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%admin%'
    OR p.proname ILIKE '%role%'
    OR p.proname ILIKE '%permission%'
    OR p.proname ILIKE '%school%'
  )
ORDER BY p.proname, arguments;

-- RESULT 4: Triggers attached to schools, academic_sessions and terms.
SELECT event_object_table AS table_name,
       trigger_name,
       action_timing,
       event_manipulation,
       action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('schools', 'academic_sessions', 'terms')
ORDER BY event_object_table, trigger_name, event_manipulation;
