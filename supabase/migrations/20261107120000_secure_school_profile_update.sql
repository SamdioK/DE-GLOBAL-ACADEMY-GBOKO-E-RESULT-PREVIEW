-- DE-GLOBAL ACADEMY GBOKO
-- Phase 4D: Secure school profile update access
-- Corrected after Phase 5B audit identified existing column-level grants.
-- Apply only after review and explicit operator approval.

BEGIN;

-- Clear table-level and column-level privileges for anonymous clients.
REVOKE ALL PRIVILEGES ON TABLE public.schools FROM anon;
REVOKE ALL PRIVILEGES (id, name, address, phone, email, logo_url, motto, created_at, updated_at)
ON TABLE public.schools FROM anon;

-- Clear broad authenticated writes and all old column-level grants.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.schools FROM authenticated;
REVOKE ALL PRIVILEGES (id, name, address, phone, email, logo_url, motto, created_at, updated_at)
ON TABLE public.schools FROM authenticated;

-- Restore authenticated read access and only approved profile-field updates.
GRANT SELECT ON TABLE public.schools TO authenticated;
GRANT UPDATE (name, address, phone, email, logo_url, motto, updated_at)
ON TABLE public.schools TO authenticated;

DROP POLICY IF EXISTS schools_admin_update_own_school ON public.schools;
CREATE POLICY schools_admin_update_own_school
ON public.schools
FOR UPDATE
TO authenticated
USING (
  public.has_role('administrator')
  AND EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND p.school_id = schools.id
  )
)
WITH CHECK (
  public.has_role('administrator')
  AND EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND p.school_id = schools.id
  )
);

COMMIT;

-- Verification A: table-level grants.
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'schools'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, privilege_type;

-- Verification B: column-level grants.
SELECT grantee, column_name, privilege_type, is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'schools'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, column_name, privilege_type;

-- Verification C: policies.
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'schools'
ORDER BY policyname;

-- Verification D: RLS state.
SELECT c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'schools' AND c.relkind = 'r';
