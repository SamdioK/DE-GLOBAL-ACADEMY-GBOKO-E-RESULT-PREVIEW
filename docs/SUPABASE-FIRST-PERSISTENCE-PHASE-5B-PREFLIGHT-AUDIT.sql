-- DE-GLOBAL ACADEMY GBOKO
-- PHASE 5B PRE-FLIGHT: READ-ONLY SCHOOL PROFILE AND MIGRATION-HISTORY AUDIT
-- Run in Supabase SQL Editor against the shared production project.
-- This script performs SELECT/metadata inspection only. It does not modify
-- migration history, grants, policies, schema, rows, Storage or browser data.

-- RESULT 1: Does the standard Supabase CLI migration history table exist?
SELECT
  to_regclass('supabase_migrations.schema_migrations') AS migration_history_table,
  CASE
    WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL
      THEN 'NOT FOUND: do not assume Phase 4D is unapplied; use the CLI migration list and report this result.'
    ELSE 'FOUND: inspect the Phase 4D version in Result 2.'
  END AS interpretation;

-- RESULT 2: Phase 4D migration history row, when the standard table exists.
-- Dynamic SQL prevents this read-only audit from failing when the table is absent.
DO $audit$
DECLARE
  history_table regclass := to_regclass('supabase_migrations.schema_migrations');
  migration_row record;
BEGIN
  IF history_table IS NULL THEN
    RAISE NOTICE 'PHASE_4D_HISTORY: migration history table not found; status is UNKNOWN, not unapplied.';
  ELSE
    EXECUTE format(
      'SELECT to_jsonb(m) AS row_data FROM %s m WHERE to_jsonb(m)->>''version'' = %L',
      history_table,
      '20261107120000'
    ) INTO migration_row;
    IF migration_row IS NULL THEN
      RAISE NOTICE 'PHASE_4D_HISTORY: no row for version 20261107120000 in the standard history table. Confirm with supabase migration list --linked before any action.';
    ELSE
      RAISE NOTICE 'PHASE_4D_HISTORY: %', migration_row.row_data;
    END IF;
  END IF;
END
$audit$;

-- RESULT 3: Effective table-level grants for public.schools.
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'schools'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, privilege_type;

-- RESULT 4: Column-level privileges for public.schools.
SELECT grantee, column_name, privilege_type, is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'schools'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, column_name, privilege_type;

-- RESULT 5: Current RLS policies for public.schools.
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'schools'
ORDER BY policyname;

-- RESULT 6: RLS enabled/forced state.
SELECT c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'schools'
  AND c.relkind = 'r';

-- RESULT 7: Exact school columns and data types used for safe mapping.
SELECT ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'schools'
ORDER BY ordinal_position;

-- RESULT 8: Existing school row (non-sensitive identity/contact fields only).
SELECT id, name, address, phone, email, logo_url, motto, created_at, updated_at
FROM public.schools
WHERE id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac';
