# Public Staff Directory — Secure Read-Path Design

**Project:** DE-GLOBAL ACADEMY GBOKO E-Result Portal  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Branch:** `main`  
**Design date:** 6 November 2026  
**Status:** Architecture and acceptance criteria only. No SQL has been executed and no database permissions have been changed.

## 1. Objective

Connect the public school portal's staff directory to the authoritative Supabase `school_staff_directory` records without exposing private staff data or weakening the existing administrator-only access model.

The public directory must show only records that are both:

- `status = 'Active'`; and
- `show_on_portal = true`.

The public client must not receive staff contact information, employment dates, profile links, creator identifiers, internal school metadata or unpublished records.

## 2. Recommended access pattern

Use a narrowly scoped anonymous SELECT permission on explicitly approved public columns, combined with a dedicated RLS policy for published rows. This is preferable to granting anonymous access to the whole table or putting a service-role key in the browser.

### Public fields proposed

- `id` — stable row identifier for rendering and selection matching;
- `full_name`;
- `designation`;
- `department`;
- `qualification`;
- `specialisation`;
- `biography`.

Do not grant anonymous column access to:

- `school_id`, `profile_id`, `staff_id`, `gender`;
- `phone`, `email`, `photo_url`, `date_employed`;
- `created_by`, `created_at`, `updated_at`;
- `status`, `show_on_portal`.

The public query should request only the approved columns and filter by the school's known UUID, Active status and publication flag. The row policy independently enforces Active + published, so a modified browser query cannot retrieve unpublished rows.

**School scope:** The current deployment serves DE-GLOBAL ACADEMY GBOKO. The frontend may use the school's public UUID as a filter, but the database policy must still enforce publication status. If the application later becomes multi-school, add a verified public school identifier/slug mapping rather than trusting arbitrary school IDs as proof of identity.

## 3. SQL migration proposal — review before execution

The following is a proposed migration, not an executed change. Confirm the actual Postgres grants, existing policies and Supabase role behaviour in the live project before applying it.

```sql
-- 1. Permit anonymous reads of only the public profile columns.
GRANT SELECT (
  id,
  full_name,
  designation,
  department,
  qualification,
  specialisation,
  biography
) ON TABLE public.school_staff_directory TO anon;

-- 2. Add a narrowly scoped row policy for public profiles.
CREATE POLICY "Public can view active published staff profiles"
ON public.school_staff_directory
FOR SELECT
TO anon
USING (
  status = 'Active'
  AND show_on_portal IS TRUE
);

-- 3. Do not add anon INSERT, UPDATE or DELETE grants or policies.
```

Before applying, check whether a policy with the same name already exists and whether any table-level SELECT grant to `anon` already exists. PostgreSQL table-level grants can override the intended column-level restriction. If broad anonymous SELECT is already granted, revoke that table-level grant and explicitly review all other anonymous access requirements before proceeding. Do not blindly revoke privileges used by unrelated portal features.

The existing administrator policies must remain intact. Do not add public access for authenticated users as a substitute for the anon policy, and do not change the existing administrator school-scoped policies.

## 4. Frontend integration requirements

1. Add a dedicated public-directory query method; do not reuse `getStaffDirectory()`, which intentionally requires authentication and selects private columns.
2. Query only the seven approved public columns.
3. Filter by the DE-GLOBAL ACADEMY GBOKO school UUID, `status = 'Active'` and `show_on_portal = true`.
4. Sort by `full_name`.
5. Render only the returned fields. Do not merge private values from legacy browser storage into public cards.
6. Keep the public directory empty or show a clear unavailable message if the request fails. Never fall back to exposing the full private Supabase directory.
7. Remove the legacy `portalStaffSelections` dependency from public rendering only after the administrator has reviewed existing saved selections and the new Supabase path has passed acceptance tests.
8. Keep the administrator's private Staff Database read/write path unchanged.

### Field selection and approval

The current schema has one record-level publication flag, `show_on_portal`, but no verified per-field consent/approval table. The initial public directory should therefore use the fixed seven-field allow-list above. Optional contact details, photos and employment dates must not be added to the public query merely because a legacy browser selection contains them.

If field-by-field publication is later required, design a separate approval model with a recorded approver, timestamp and permitted field list. Do not treat a browser-stored selection as a security boundary.

## 5. Acceptance tests

Run these tests in a controlled window. Do not publish real staff records merely to make a test pass.

| Test | Expected result |
|---|---|
| Anonymous request for the seven approved columns | Only Active + published records for the requested school are returned |
| Anonymous request for phone, email or photo_url | Permission denied |
| Anonymous request for unpublished staff | No rows returned |
| Anonymous request for Inactive or Suspended staff | No rows returned |
| Anonymous insert/update/delete | Permission denied |
| Administrator Staff Database | Existing administrator access continues to work |
| Sub-administrator / Form Master / student | Private staff table remains inaccessible |
| Cross-school query | Only records satisfying the publication policy are eligible; no private columns are readable |
| Public query failure | No private browser-storage or full-table fallback |
| Existing saved legacy selections | Reviewed before public directory launch; private fields excluded |

Capture the test date, account role, query, result and outcome in the security audit. Do not record passwords, access tokens or unnecessary personal data.

## 6. Rollback plan

If the public query exposes an unintended field or row:

1. Disable the public directory frontend query.
2. Revoke the anonymous column privileges granted for this feature.
3. Drop only the new public staff RLS policy.
4. Confirm the existing administrator SELECT/INSERT/UPDATE policies remain unchanged.
5. Re-run administrator and anonymous denial tests.

Do not disable RLS and do not use a service-role key in the frontend.

## 7. Current implementation boundary

The current public staff display still depends on legacy browser storage, while the administrator Staff Database reads from Supabase. This design deliberately separates the two until the public query is secured and tested.

The Staff Database contains 15 existing records according to the last supplied audit. Public visibility was reported as false for all 15 at that audit. Do not change these records or enable publication automatically.

## 8. Completion checklist

- [ ] Review actual grants and all existing RLS policies in Supabase.
- [ ] Confirm there is no broad anonymous table-level SELECT grant.
- [ ] Obtain approval to apply the reviewed SQL migration.
- [ ] Apply the narrow policy and column grants.
- [ ] Implement the dedicated public query using only approved columns.
- [ ] Deploy preview and verify anonymous positive/negative tests.
- [ ] Review legacy saved field selections.
- [ ] Obtain explicit approval before publishing any staff profile.
- [ ] Update the Staff Database security audit with actual test evidence.
- [ ] Add this section to the consolidated trainer/trainee manual after acceptance.

**No database changes have been made by this design document.**
