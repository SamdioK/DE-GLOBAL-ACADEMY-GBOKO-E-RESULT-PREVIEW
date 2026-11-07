-- DE-GLOBAL ACADEMY GBOKO
-- PHASE 4D: SECURE SCHOOL PROFILE UPDATE ACCESS
--
-- This is the first controlled write migration in the legacy-storage
-- cutover. Run once in Supabase SQL Editor as an authorised database
-- administrator. Review the complete script before execution.
--
-- Scope:
--   * Remove anonymous access to public.schools.
--   * Keep authenticated SELECT access.
--   * Remove broad authenticated INSERT/DELETE/table UPDATE access.
--   * Grant UPDATE only on approved school profile fields.
--   * Permit UPDATE only to an active administrator of that same school.
--   * Return verification result sets after the transaction.
--
-- This does NOT migrate browser data, alter students/classes/results,
-- change academic sessions or terms, or remove browser storage.

BEGIN;

-- Remove table-level AND column-level grants. PostgreSQL keeps
-- column grants separate from table grants, so table-level REVOKE alone
-- does not clear the column privileges identified in the Phase 5B audit.
REVOKE ALL PRIVILEGES ON TABLE public.schools FROM anon;
REVOKE ALL PRIVILEGES (id, name, address, phone, email, logo_url, motto, created_at, updated_at)
ON TABLE public.schools FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.schools FROM authenticated;
REVOKE ALL PRIVILEGES (id, name, address, phone, email, logo_url, motto, created_at, updated_at)
ON TABLE public.schools FROM authenticated;

-- Re-establish only the intended authenticated access.
GRANT SELECT ON TABLE public.schools TO authenticated;

GRANT SELECT ON TABLE public.schools TO authenticated;

GRANT UPDATE (
    name,
    address,
    phone,
    email,
    logo_url,
    motto,
    updated_at
)
ON TABLE public.schools TO authenticated;

-- Replace only this migration's named policy, making this section rerunnable.
DROP POLICY IF EXISTS schools_admin_update_own_school ON public.schools;

CREATE POLICY schools_admin_update_own_school
ON public.schools
FOR UPDATE
TO authenticated
USING (
    public.has_role('administrator')
    AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.is_active = TRUE
          AND p.school_id = schools.id
    )
)
WITH CHECK (
    public.has_role('administrator')
    AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.is_active = TRUE
          AND p.school_id = schools.id
    )
);

COMMIT;

-- =========================================================
-- VERIFY 1: Effective direct table grants for anon/authenticated
-- Expected: anon has no rows; authenticated has SELECT only.
-- =========================================================
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'schools'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, privilege_type;

-- =========================================================
-- VERIFY 2: Column-level privileges
-- Expected authenticated UPDATE only on the seven approved fields.
-- =========================================================
SELECT grantee, column_name, privilege_type, is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'schools'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, column_name, privilege_type;

-- =========================================================
-- VERIFY 3: School RLS policies
-- Expected: existing SELECT policy/policies plus this UPDATE policy.
-- =========================================================
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'schools'
ORDER BY policyname;

-- =========================================================
-- VERIFY 4: RLS enabled/forced state
-- Expected: rls_enabled = true.
-- =========================================================
SELECT
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'schools'
  AND c.relkind = 'r';
