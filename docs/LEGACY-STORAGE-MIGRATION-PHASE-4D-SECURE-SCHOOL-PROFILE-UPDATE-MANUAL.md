# Phase 4D — Secure School Profile Update Access
## Operational and Training Manual

**System:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Phase:** Legacy Storage Migration — Phase 4D  
**Purpose:** Establish a narrow, database-enforced school profile update path before connecting the school profile form to Supabase.

## 1. Objective and scope

This phase removes unnecessary direct anonymous access and broad authenticated write privileges on `public.schools`. The Phase 5B audit found existing column-level privileges as well as table-level privileges. PostgreSQL treats these separately, so the corrected migration explicitly revokes both before regranting the approved access. It retains authenticated reading and permits an active administrator to update only approved school profile fields for the school linked to that administrator's active profile.

Approved fields:
- `name`
- `address`
- `phone`
- `email`
- `logo_url`
- `motto`
- `updated_at`

The primary key `id` and creation timestamp `created_at` are not updateable through this grant. INSERT, DELETE and broad table UPDATE are not granted to authenticated users by this migration.

## 2. Security model

The policy requires both:
1. `public.has_role('administrator')`, which checks the authenticated user's active primary or active additional role using the already reviewed helper.
2. An active `profiles` row for `auth.uid()` whose `school_id` equals the target `schools.id`.

The same checks apply before and after an update through `USING` and `WITH CHECK`. Column privileges limit which school fields the authenticated role may update. RLS remains enabled.

The migration does not use a service-role key, does not disable RLS, and does not grant access across schools.

## 3. Before running

1. Confirm you are in the Supabase project for DE-GLOBAL ACADEMY GBOKO.
2. Confirm the corrected Phase 4D SQL explicitly revokes both table-level and column-level grants for `anon` and `authenticated`.
3. Open Supabase SQL Editor using an authorised database administrator account.
4. Review the complete corrected Phase 4D SQL file.
5. Run the entire script once, but only after explicit approval to apply it. The transaction applies the grants and policy together; verification SELECT statements then return four result sets.
5. If any error occurs, stop and send the exact error. Do not manually run only selected write statements.

## 4. Expected verification

### Verify 1 — table grants
- No direct table grants should remain for `anon`.
- `authenticated` should have SELECT only at table level.
- There should be no authenticated table-level INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES or TRIGGER grant.

### Verify 2 — column grants
- Authenticated SELECT may appear for the table's columns.
- Authenticated UPDATE should appear only for the seven approved fields listed above.
- No anonymous column privileges should remain.
- Authenticated UPDATE must exist only for `name`, `address`, `phone`, `email`, `logo_url`, `motto` and `updated_at`.
- Authenticated must not retain column-level INSERT or REFERENCES privileges.

### Verify 3 — policies
- Existing authenticated SELECT policy/policies should remain.
- A policy named `schools_admin_update_own_school` should exist for UPDATE and target authenticated users.
- The policy must contain both administrator-role and same-school active-profile checks.

### Verify 4 — RLS
- `rls_enabled` must be true.

Do not treat successful SQL execution alone as proof of application-level success. Return all four result sets for review.

## 5. Application integration gate

Do not yet change the school profile form to save directly. After the SQL results are reviewed, the frontend integration will:
1. Resolve the signed-in user's active profile and school ID from Supabase, not from a browser-supplied school ID.
2. Read the existing school row.
3. Submit only approved profile fields.
4. Check Supabase errors and require exactly one returned updated row.
5. Read the row back from Supabase and render the returned values.
6. Never fall back to localStorage, IndexedDB or `window.storage` if the database write fails.

## 6. Acceptance tests after frontend integration

- Active administrator updates the school's address: allowed and read-back matches.
- Active administrator updates the school's phone/email: allowed.
- Form Master, subject teacher and student attempt the update: denied.
- Unauthenticated/anonymous client attempts to read or update the school row: denied by the applicable grants and RLS.
- An administrator from another school attempts to update this school's row: denied.
- Attempt to update `id` or `created_at`: denied by column privileges.
- Network failure: interface reports failure and does not show unsaved values as persisted.
- Reload and sign in on another device: saved school profile is loaded from Supabase.

## 7. Rollback

If an unexpected access issue appears, stop application rollout. An authorised database administrator can remove only the new policy with:

```sql
DROP POLICY IF EXISTS schools_admin_update_own_school ON public.schools;
```

Do not restore broad grants as a troubleshooting shortcut. Any privilege rollback must be based on the recorded pre-migration audit and reviewed separately.

## 8. Training exercise

Using an authorised administrator account, update one non-critical school profile field to an approved value, save, reload the page, and confirm the value is retrieved from Supabase. Then sign in with a non-administrator account and confirm that no school profile update is permitted.

## 9. Completion criteria

Phase 4D is complete only after:
- The SQL has been executed by the authorised user.
- All four verification result sets have been reviewed.
- Positive administrator and negative non-administrator/cross-school tests pass after frontend integration.
- The school profile form reads and writes Supabase only.
- The application reports database failures without local fallback.

**Important:** The earlier Phase 4D SQL draft did not explicitly revoke column-level grants. Do not use an earlier downloaded copy. Use the corrected SQL in the repository. This phase secures the school profile write path. It does not complete the overall legacy browser-storage migration. Other data categories remain scheduled for separate mapping, integration, reconciliation and testing.
