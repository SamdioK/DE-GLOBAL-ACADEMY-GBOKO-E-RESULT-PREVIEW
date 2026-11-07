# Phase 4C — School Profile Privilege and RLS Design Audit

## Purpose
Establish the actual table and column privileges on `public.schools`, the table's RLS state, the execute grants on existing role helper functions, and the school's constraints before designing a narrow administrator update path.

This is a read-only inspection. It does not change grants, policies, functions, records or schema.

## Findings carried forward from Phase 4B
- The existing `schools` policy inventory showed authenticated SELECT only.
- The role helper `public.has_role('administrator')` checks an active primary profile role or an active matching `profile_roles` row.
- The helper is SECURITY DEFINER with `search_path=public`; its reviewed body schema-qualifies the referenced public tables and `auth.uid()`.
- The helper does not itself scope an update to the caller's school. The future policy must enforce `schools.id` equals the active caller profile's `school_id`.
- No triggers were returned for `schools`, `academic_sessions` or `terms`.
- No school UPDATE policy has been confirmed.

## Run procedure
1. Open Supabase SQL Editor.
2. Open `LEGACY-STORAGE-MIGRATION-PHASE-4C-SCHOOL-PRIVILEGE-AUDIT.sql`.
3. Run each labelled RESULT query separately.
4. Return all six result sets. If any query errors, return the exact error.
5. Do not execute any grant, revoke, policy, DDL or DML statement.

## Result guide
- Result 1: table-level privileges granted to public, anon and authenticated.
- Result 2: column-level privileges; these may allow a narrower update design than a table-wide UPDATE grant.
- Result 3: table owner and whether RLS is enabled/forced.
- Result 4: who can execute the existing role helper functions.
- Result 5: confirms the helper function definitions/settings in the current database state.
- Result 6: constraints that may affect updates.

## Proposed security shape — not executable SQL
A future update must be restricted to:
- authenticated caller;
- active caller profile;
- caller profile's own `school_id`;
- active `administrator` role;
- a short allow-list of basic school profile columns, such as `name`, `address`, `phone`, `email` and `motto`, only after confirming intended fields.

The update must not change school identity, ownership, academic sessions, terms, profile roles, permissions, or privileged metadata. Logo/signature/stamp files remain a separate private Storage project.

## Why privileges are checked separately
RLS determines which rows a role may access. PostgreSQL grants determine which operations and columns the role may attempt. Both must be correct. A safe policy is not enough if broad table-level grants defeat intended column limits; a column grant is not enough without restrictive RLS.

## Acceptance tests after implementation
- Administrator can update only the linked school's allow-listed fields.
- Administrator cannot update another school's row.
- Form Master, Subject Teacher, Sub-Administrator, Student and unauthorised developer accounts cannot update the school row.
- Caller cannot change school id or unrelated columns.
- Failed updates leave the existing UI values and browser cache unchanged.
- Successful updates are read back from Supabase before the UI/cache is refreshed.
- No service-role key is shipped to the browser.

## Completion gate
Do not write an UPDATE policy, grant privileges, deploy an Edge Function or change the frontend until all six outputs are reviewed and the exact column-level strategy is approved. Preview and live share the same Supabase project, so any successful write affects the real school database.

## Training exercise
Explain the difference between table grants, column grants and RLS. Identify why a role helper must be combined with a same-school row condition, and demonstrate which negative tests are required.
