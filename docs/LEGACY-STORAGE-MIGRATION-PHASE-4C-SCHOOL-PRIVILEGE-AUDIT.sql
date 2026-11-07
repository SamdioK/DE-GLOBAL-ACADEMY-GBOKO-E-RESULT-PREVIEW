-- DE-GLOBAL ACADEMY GBOKO
-- Phase 4C: School profile table/column/function privilege audit
-- READ-ONLY ONLY. Run each RESULT section separately.
-- No grants, policies, schema, records or functions are changed.

-- RESULT 1: Table-level privileges on schools for anon/authenticated/public.
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'schools'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, privilege_type;

-- RESULT 2: Column-level privileges on schools.
SELECT grantee, column_name, privilege_type, is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'schools'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, column_name, privilege_type;

-- RESULT 3: RLS enabled/forced state and relation owner for schools.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS table_owner,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'schools'
  AND c.relkind = 'r';

-- RESULT 4: Execute privileges for existing role helpers.
SELECT routine_schema, routine_name, grantee, privilege_type, is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('has_role', 'has_permission', 'current_user_role')
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY routine_name, grantee, privilege_type;

-- RESULT 5: Full role helper definitions and security settings.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('has_role', 'has_permission', 'current_user_role')
ORDER BY p.proname, arguments;

-- RESULT 6: School table constraints (column restrictions, keys and checks).
SELECT con.conname AS constraint_name,
       con.contype AS constraint_type,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'schools'
ORDER BY con.conname;
