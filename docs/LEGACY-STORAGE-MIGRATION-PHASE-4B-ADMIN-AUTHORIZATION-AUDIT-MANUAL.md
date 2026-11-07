# Phase 4B — Administrator Authorisation and School Profile Persistence Audit

## Purpose
Inspect the existing administrator/role authorisation model before designing a secure school-profile update path for DE-GLOBAL ACADEMY GBOKO.

This phase is an inspection gate only. It does not enable writes, alter RLS, change records, or deploy frontend functionality.

## Confirmed context
- School: DE-GLOBAL ACADEMY GBOKO.
- School UUID: `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`.
- The current login flow validates an active `profiles` record, reads `profile_roles`, and recognises the `administrator` role for the School Administrator login type.
- The current school-profile tables have authenticated SELECT policies only; no UPDATE policy has been confirmed.
- `supabase-persistence.js` has generic authenticated CRUD helpers and a school-scoped profile reader. Generic client-side authentication is not a substitute for database-enforced authorisation.
- The frontend must never contain a Supabase service-role key.

## Roles
- School Administrator: may be eligible to edit the school's basic profile, subject to verified database-side role and school checks.
- Other roles (Form Master, Subject Teacher, Sub-Administrator, Student and Portal Developer): must not receive school-profile write access merely because they can authenticate.
- Database policies or a narrowly scoped server-side function must derive the caller's identity from the verified JWT, resolve the active profile and school association, and enforce the approved role. Never trust a school UUID or role supplied only by the browser.

## Run the audit
1. Open the Supabase project SQL Editor.
2. Open `LEGACY-STORAGE-MIGRATION-PHASE-4B-ADMIN-AUTHORIZATION-AUDIT.sql` from this repository.
3. Run each labelled RESULT query separately.
4. Return all four result sets, including exact errors if any query fails.
5. Do not run UPDATE, INSERT, DELETE, CREATE POLICY, ALTER TABLE, or any other write statement.

## Result interpretation
- Result 1: establishes which policies currently govern profiles, role tables, schools, sessions and terms. A SELECT policy is not a write policy.
- Result 2: establishes the actual role/permission columns, including whether role rows have an active-state field.
- Result 3: identifies existing database helpers and exposes their definitions/settings for security review. SECURITY DEFINER functions require careful review of fixed search_path, caller checks, privilege scope and object qualification.
- Result 4: identifies triggers that may alter school or academic rows during updates.

## Security acceptance criteria before implementation
- Administrator authority must be checked server-side or by a restrictive RLS policy; a hidden button or JavaScript role check is insufficient.
- The caller must have an active profile linked to the exact school row being changed.
- Only the approved administrator role may update the explicitly approved school-profile fields.
- The operation must not allow changing `id`, timestamps, ownership, profile roles, academic session or term records.
- The school UUID must be derived from the authenticated profile, not accepted as an unrestricted client parameter.
- Non-administrator and cross-school negative tests must fail.
- Browser cache must be updated only after Supabase confirms the update and returns the saved row.
- On failure, preserve the previous displayed values and local data.
- No service-role key in browser code; no broad authenticated UPDATE policy.

## Deferred items
- Logo, signature and stamp uploads require a separate Storage bucket/path and access-policy review. Do not store base64 image data in `logo_url`.
- Academic session and term editing are outside this school-profile update scope.
- Existing legacy browser data remains intact.
- Preview and live website share the same Supabase project; any successful preview write is a real database write.

## Completion gate
Phase 4B audit is complete only after all four outputs have been reviewed. The implementation approach (RLS-protected direct update versus a narrowly scoped Edge Function) must then be selected based on actual policies, helper definitions and deployed backend availability. No write SQL or frontend integration is authorised by this audit alone.

## Training exercise
Trainees should identify the administrator role source, distinguish SELECT from UPDATE permissions, locate any reusable secure helper, and explain why browser-side role checks cannot protect a database row.
