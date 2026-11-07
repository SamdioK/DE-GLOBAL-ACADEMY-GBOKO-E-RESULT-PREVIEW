-- DE-GLOBAL ACADEMY GBOKO
-- Phase 4D: Secure school profile update access
-- Versioned copy for Supabase CLI deployment.
-- Review and apply only through the protected/manual GitHub Actions workflow.

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.schools FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.schools FROM authenticated;

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
