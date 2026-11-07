-- Phase 5C post-migration verification: read-only.
-- Expected: no anon grants; authenticated table-level SELECT only.
SELECT table_name, grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('classes','form_master_assignments','teacher_assignments','students','student_enrolments')
  AND grantee IN ('anon','authenticated','PUBLIC')
ORDER BY table_name,grantee,privilege_type;

-- Expected: no anon or authenticated column-level grants.
SELECT table_name,column_name,grantee,privilege_type,is_grantable
FROM information_schema.column_privileges
WHERE table_schema='public'
  AND table_name IN ('classes','form_master_assignments','teacher_assignments','students','student_enrolments')
  AND grantee IN ('anon','authenticated')
ORDER BY table_name,grantee,column_name,privilege_type;

-- Expected: RLS enabled; original SELECT policies remain present.
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('classes','form_master_assignments','teacher_assignments','students','student_enrolments')
ORDER BY c.relname;

SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('classes','form_master_assignments','teacher_assignments','students','student_enrolments')
ORDER BY tablename,policyname;
