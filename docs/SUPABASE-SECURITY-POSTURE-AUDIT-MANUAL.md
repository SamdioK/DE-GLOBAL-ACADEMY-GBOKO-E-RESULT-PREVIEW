# Supabase Security Posture Audit — Operational and Training Manual

**System:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Stage:** Read-only production security inspection  
**Project reference:** rvmcqvfuioxmbtvgdptb  
**Database writes:** None

## Purpose

Collect a current, evidence-based view of public-schema RLS, table and column grants, RLS policies, SECURITY DEFINER functions, views, Storage buckets and policies, default privileges, and migration history.

This audit is required before further persistence cutover. Existing source files and earlier screenshots are not substitutes for current live database results.

## Required operator

An authorised project administrator with access to the correct Supabase Dashboard and SQL Editor.

## Procedure

1. Open the DE-GLOBAL ACADEMY GBOKO Supabase project.
2. Open **SQL Editor**.
3. Open `docs/SUPABASE-SECURITY-POSTURE-AUDIT.sql` from this repository.
4. Copy and run the script without editing it.
5. Capture all ten labelled result sections, including empty result sets and any NOTICE/error output.
6. Return the results for review. If a query errors, stop and provide the exact error; do not improvise schema changes.
7. Do not run migrations, grants, revokes, policy changes, or data modifications as part of this audit.

## Result interpretation

1. **Public table RLS:** all exposed application tables should have RLS enabled. FORCE RLS is a separate control; table owners and service roles may have different behaviour.
2. **Table grants:** identify broad privileges granted to PUBLIC, anon or authenticated.
3. **Column grants:** identify independently granted column permissions that may remain after table-level revokes.
4. **Policies:** verify commands, roles, USING and WITH CHECK expressions. A policy is not proof that a role has the SQL privilege required for an operation.
5. **SECURITY DEFINER functions:** inspect owner, ACL, configured search_path, caller checks, and fully qualified object references. Do not expose or change function secrets.
6. **Views:** review view owners and options. Views over RLS-protected tables require particular care; confirm whether invoker security is appropriate for each view.
7. **Storage buckets:** record public/private visibility and upload limits. Do not change bucket visibility.
8. **Storage policies:** verify object read/write paths are scoped by authenticated identity, school and intended role.
9. **Default privileges:** check what permissions future objects inherit.
10. **Migration history:** compare SQL history with the protected linked CLI migration listing. Missing SQL history does not prove that no migration was applied manually.

## Stop conditions

Stop and request review if:
- any public application table has RLS disabled unexpectedly;
- anon or PUBLIC has access to student, enrolment, result, staff, profile or assignment data;
- authenticated writes are broader than the approved workflow;
- a policy lacks school scoping or uses untrusted client-supplied identity;
- a SECURITY DEFINER function lacks a safe search_path or verified caller checks;
- a view may bypass intended RLS;
- a Storage bucket is public without explicit approval or object policies are too broad;
- migration history is inconsistent or any query errors.

Do not attempt to fix a finding by disabling RLS, granting broad privileges, changing production rows, or re-running an existing migration.

## Data protection

The queries inspect database metadata and policy/function definitions. They do not select student names, contact details, credentials, marks, or other personal records. Before sharing results, review screenshots for unrelated personal information and redact any sensitive values.

## Acceptance criteria

- All ten result sections are reviewed.
- Public application tables and grants are understood.
- Every RLS policy is checked for role and school scope.
- SECURITY DEFINER functions and views are reviewed.
- Storage visibility and object policies are reviewed.
- Default privileges and migration history are reconciled.
- Findings are classified as pass, remediation required, or unable to verify.
- No production records or security objects were changed.

## Current limitation

The connected GitHub access can inspect repository files but cannot execute SQL against the user's Supabase project. The live SQL results must be supplied by an authorised project operator. This audit is not complete until those live results are reviewed.

## Training exercise

Ask the trainee to explain the difference between SQL grants and RLS, identify why column-level grants need separate inspection, and demonstrate how a SECURITY DEFINER function or view could affect access boundaries.
