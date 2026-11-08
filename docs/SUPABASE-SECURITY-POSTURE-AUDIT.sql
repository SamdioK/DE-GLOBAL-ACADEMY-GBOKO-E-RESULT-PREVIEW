-- DE-GLOBAL ACADEMY GBOKO
-- Supabase security posture audit — READ ONLY
-- Run in the production project's Supabase SQL Editor.
-- This file contains SELECT statements only. It does not inspect student names,
-- contact details, credentials, result values, or other personal records.
-- Do not append write statements or run any migration during this audit.

-- RESULT 1: Every public table and its RLS state.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS table_owner,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- RESULT 2: Table-level grants to PUBLIC, anon and authenticated.
SELECT table_name, grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_name, grantee, privilege_type;

-- RESULT 3: Column-level grants to anon and authenticated.
-- This is essential because table-level REVOKE does not necessarily remove
-- independently granted column privileges.
SELECT table_name, column_name, grantee, privilege_type, is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon','authenticated')
ORDER BY table_name, grantee, column_name, privilege_type;

-- RESULT 4: All public-schema RLS policies and their predicates.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression,
       with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- RESULT 5: SECURITY DEFINER functions in public, including configured
-- search_path. Review each function for caller checks and object qualification.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS return_type,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       pg_get_userbyid(p.proowner) AS function_owner,
       p.proacl AS function_acl,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = TRUE
ORDER BY p.proname, arguments;

-- RESULT 6: Public views and materialised views, including view options.
-- Check security_invoker settings for views that read RLS-protected tables.
SELECT n.nspname AS schema_name,
       c.relname AS view_name,
       CASE c.relkind WHEN 'm' THEN 'materialized view' ELSE 'view' END AS object_type,
       c.reloptions AS view_options,
       pg_get_userbyid(c.relowner) AS view_owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('v','m')
ORDER BY c.relname;

-- RESULT 7: Storage buckets. Bucket visibility is metadata, not proof that
-- object-level policies are safe.
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
FROM storage.buckets
ORDER BY id;

-- RESULT 8: Storage object policies.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression,
       with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename IN ('objects','buckets')
ORDER BY tablename, policyname;

-- RESULT 9: Default privileges affecting future objects in public.
SELECT COALESCE(n.nspname, '(all schemas)') AS schema_name,
       pg_get_userbyid(d.defaclrole) AS grantor,
       d.defaclobjtype AS object_type,
       d.defaclacl AS default_acl
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE d.defaclnamespace = 0
   OR n.nspname = 'public'
ORDER BY schema_name, grantor, object_type;

-- RESULT 10: Migration history table presence and structure.
-- This query remains safe if the standard history table does not exist.
-- Reconcile the actual remote versions with the linked Supabase CLI
-- migration list workflow; do not infer deployment status from this result.
SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_history_table;

SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations'
  AND table_name = 'schema_migrations'
ORDER BY ordinal_position;
