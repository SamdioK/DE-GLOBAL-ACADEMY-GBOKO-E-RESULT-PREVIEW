# Staff Database — Security and Access Audit

**Project:** DE-GLOBAL ACADEMY GBOKO E-Result Portal  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Branch:** `main`  
**Audit updated:** 7 November 2026  
**Scope:** Supabase schema, grants, RLS policies, public RPC and frontend read path  
**Production records modified:** None during the security verification

## 1. Executive result

The staff directory contains 15 records for DE-GLOBAL ACADEMY GBOKO. All 15 are linked to existing active profiles in the same school. No school mismatches were found. All 15 staff records are Active, but none is approved for public display.

The public directory is now connected in `index.html` to the dedicated Supabase RPC function `public.get_public_school_staff_directory()`. The public page no longer builds staff cards from legacy browser-storage staff records or legacy per-field selections.

The anonymous access tests passed:
- The RPC, executed as role `anon`, returned zero staff rows, as expected while no record is approved for publication.
- A direct anonymous SELECT from `public.school_staff_directory` failed with PostgreSQL error `42501: permission denied`.

No broad anonymous SELECT grant was added to the staff table.

## 2. Database facts verified

### School and staff counts

| Check | Result |
|---|---:|
| School | DE-GLOBAL ACADEMY GBOKO |
| School UUID | `b135a823-0a04-4b4b-86dd-2b20ea5e9fac` |
| Staff records | 15 |
| Linked profiles found | 15 |
| Same-school profile links | 15 |
| School mismatches | 0 |
| Linked active profiles | 15 |
| Recognised staff account roles | 15 |
| Active staff records | 15 |
| Inactive / Suspended records | 0 / 0 |
| Approved for public display | 0 |
| Staff records with staff ID | 0 |
| Staff records with photographs | 0 |

### Relevant schema

`school_staff_directory` contains private fields including `school_id`, `profile_id`, `staff_id`, `phone`, `email`, `date_employed`, `biography`, `created_by`, status and publication metadata. Its status constraint accepts exactly `Active`, `Inactive` and `Suspended`.

RLS is enabled on `school_staff_directory`, `profiles` and `profile_roles`. The supplied policies restrict staff-directory insert, select and update to active administrators in the same school. No staff-directory DELETE policy was supplied.

Anonymous direct table privileges were revoked. Authenticated DELETE was revoked from `profiles` and `school_staff_directory`. Do not re-grant broad anonymous table access.

## 3. Public RPC design

The deployed function is:

```sql
CREATE OR REPLACE FUNCTION public.get_public_school_staff_directory()
RETURNS TABLE (
    id uuid,
    full_name text,
    photo_url text,
    designation text,
    department text,
    qualification text,
    specialisation text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
    SELECT
        d.id,
        d.full_name,
        d.photo_url,
        d.designation,
        d.department,
        d.qualification,
        d.specialisation
    FROM public.school_staff_directory AS d
    WHERE d.school_id = 'b135a823-0a04-4b4b-86dd-2b20ea5e9fac'::uuid
      AND d.status = 'Active'
      AND d.show_on_portal IS TRUE
    ORDER BY d.full_name ASC;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION
    public.get_public_school_staff_directory()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.get_public_school_staff_directory()
TO anon, authenticated;
```

The function is deliberately scoped to the school's fixed UUID and returns only the seven listed columns. It filters to Active records with `show_on_portal = true`. It does not return phone, email, staff ID, profile ID, employment date, biography, creator information or school metadata.

**Security note:** This function uses `SECURITY DEFINER` and `row_security = off`. Its safety depends on its fixed school scope, fixed output allow-list, publication filters and restricted function execution. Keep its owner tightly controlled. Do not add caller-controlled school IDs, dynamic SQL, or additional columns without a fresh security review.

## 4. Frontend integration verified

In `index.html`, `showPublicPortal()` calls:

```javascript
supabaseClient.rpc('get_public_school_staff_directory')
```

The public Staff List renders only the RPC response fields:
- `full_name`
- `photo_url`
- `designation`
- `department`
- `qualification`
- `specialisation`

The stable row `id` is returned by the function but is not rendered as a public profile detail.

If the RPC fails or Supabase is unavailable, the portal displays a temporary-unavailable message. It does not fall back to the legacy staff database or expose private browser-storage values.

The default legacy portal field selection is privacy-first, but the public staff list no longer relies on those browser-stored selections. The database publication flag is the authoritative record-level gate.

## 5. Tests performed and outcomes

| Test | Observed result | Outcome |
|---|---|---|
| Staff-to-profile linkage aggregate | 15 found; 15 same-school; 0 mismatches | Pass |
| Active staff and publication counts | 15 Active; 0 approved | Pass |
| Anonymous RPC execution using `SET LOCAL ROLE anon` | 0 rows | Pass |
| Anonymous direct SELECT from staff table | Permission denied, SQLSTATE 42501 | Pass |
| Public frontend source inspection | RPC call and fixed public-field rendering present | Pass |

The anonymous RPC result of zero is correct because no staff record is currently approved for public publication. Do not enable publication merely to obtain a non-zero test result.

## 6. Operational publication workflow

1. An authorised administrator opens Staff Database.
2. The administrator verifies a staff member's details against school records.
3. The administrator confirms that publication is authorised.
4. The administrator changes that individual record's `show_on_portal` flag to true while its status remains Active.
5. The public directory returns the record on its next load, limited to the RPC's fixed columns.
6. To withdraw a profile, set `show_on_portal` to false or change the status from Active.

Do not publish phone numbers, email addresses, employment dates or biographies through this RPC. If additional public fields are required, design a separate approval and allow-list process first.

## 7. Remaining acceptance checks

- Verify a single authorised test record can be published and then withdrawn, with the public RPC returning one row and then zero rows. Use an approved test record or obtain explicit school authorisation; do not publish a real staff member merely for testing.
- Verify the deployed hosting environment is serving the current `main` branch version of `index.html`.
- Verify the browser console shows no RPC errors and the public portal displays the expected empty-state message while the publication count is zero.
- Recheck function ownership and grants after any database migration.

## 8. Rollback

If an unintended record or field is exposed:
1. Remove the public directory section from the portal deployment or temporarily disable its RPC call.
2. Set affected records' `show_on_portal` flags to false.
3. Revoke EXECUTE on the RPC from `anon` and `authenticated` if required.
4. Review function definition, owner, grants and audit logs before restoring service.

Never respond to a permission error by granting anonymous SELECT on the underlying staff table.

## 9. Training exercise

Using a non-production or explicitly authorised test record:
1. Confirm the record is Active and unpublished.
2. Execute the RPC as `anon` and confirm the row is absent.
3. Approve publication through the administrator workflow.
4. Execute the RPC as `anon` and confirm only the approved public columns are returned.
5. Withdraw publication and confirm the row disappears again.
6. Attempt direct anonymous table SELECT and confirm it remains denied.
