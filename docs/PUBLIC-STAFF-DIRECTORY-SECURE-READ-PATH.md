# Public Staff Directory — Secure Read Path and Operational Guide

**Project:** DE-GLOBAL ACADEMY GBOKO E-Result Portal  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Branch:** `main`  
**Updated:** 7 November 2026  
**Status:** RPC and frontend integration present; anonymous access checks passed

## 1. Purpose

The public School Portal obtains staff profiles through the dedicated Supabase function `public.get_public_school_staff_directory()`. It does not read the private staff table directly and does not use legacy browser-storage staff records as a fallback.

The directory returns only staff who satisfy both conditions:
- `status = 'Active'`; and
- `show_on_portal = true`.

The function is scoped to DE-GLOBAL ACADEMY GBOKO by its fixed school UUID:
`b135a823-0a04-4b4b-86dd-2b20ea5e9fac`.

## 2. Public data allow-list

The function returns exactly these columns:

| Column | Purpose |
|---|---|
| `id` | Stable row identifier |
| `full_name` | Public staff name |
| `photo_url` | Approved staff photograph URL |
| `designation` | Position |
| `department` | Department |
| `qualification` | Qualification |
| `specialisation` | Specialisation or subject |

It does not return phone, email, staff ID, profile ID, gender, date employed, biography, creator details, school ID, status or publication metadata.

Do not add fields to the function merely because the administrator interface or an old browser selection contains them. Additional fields require a privacy review and an explicit publication design.

## 3. How the public request works

The public portal's `showPublicPortal()` function calls:

```javascript
var publicStaffResult = await supabaseClient.rpc(
  'get_public_school_staff_directory'
);
```

The page renders the returned fields only. If the RPC returns an error, or the Supabase client is unavailable, the page displays:

> The staff directory is temporarily unavailable.

It does not fall back to the legacy `staffDatabase` or `portalStaffSelections` values. When the RPC returns no rows, the page displays:

> No staff profiles are currently published.

## 4. Database access model

- RLS remains enabled on the private staff table.
- Anonymous users have no direct SELECT privilege on `school_staff_directory`.
- Anonymous and authenticated callers receive EXECUTE on the dedicated RPC only.
- The function is `SECURITY DEFINER`, uses an empty `search_path`, and has `row_security = off`.
- The query has a fixed school UUID, fixed output columns and fixed publication filters.
- No service-role key is used in browser code.

The function owner must remain a trusted database owner. Do not change the function to accept an arbitrary school ID, add dynamic SQL, or widen the output without security review.

## 5. Publication workflow for administrators

1. Sign in with the authorised school administrator account.
2. Open **Staff Database**.
3. Search for the staff member and open the correct record.
4. Verify the name, designation, department, qualification and specialisation against authorised school records.
5. Confirm that the staff member's profile is approved for public display.
6. Set the record status to **Active**.
7. Enable **Show on School Portal** for that record and save.
8. Open or refresh the public School Portal and confirm that only the approved fields appear.

A staff member who is Active but has `show_on_portal = false` remains private. An Inactive or Suspended record is not returned even if its publication flag is accidentally true.

To withdraw a profile, disable **Show on School Portal** or change its status from Active. The next public directory request will omit the record.

**Current live baseline:** 15 staff records; 15 Active; 0 approved for public publication. Therefore, the correct public directory result is zero records.

## 6. Security tests and expected results

Run tests in Supabase SQL Editor. These tests do not expose staff names or contact details.

### Test A — public RPC under the anonymous role

```sql
BEGIN;
SET LOCAL ROLE anon;

SELECT COUNT(*) AS publicly_visible_staff
FROM public.get_public_school_staff_directory();

ROLLBACK;
```

Expected current result: `0`.

### Test B — direct access to the private staff table

```sql
BEGIN;
SET LOCAL ROLE anon;

SELECT COUNT(*) AS direct_staff_table_access
FROM public.school_staff_directory;

ROLLBACK;
```

Expected result: permission denied, SQLSTATE `42501`. Do not grant SELECT to anon in response to this error.

### Test C — authorised publication test

Only use a test record or a real staff record whose publication has been explicitly authorised. Enable its publication flag, call the RPC as anon and confirm the one approved record appears with only the allow-listed columns. Disable publication again and confirm it disappears. Do not publish staff simply to make a test pass.

## 7. Troubleshooting

| Symptom | Likely cause | Safe action |
|---|---|---|
| Directory says temporarily unavailable | RPC missing, execute grant missing, Supabase client unavailable or network error | Check browser console, function definition and EXECUTE grants |
| Directory shows no staff | No Active records have `show_on_portal = true` | Check aggregate publication count; do not loosen filters |
| Direct table SELECT is denied | Expected privacy control | Do not grant anonymous table SELECT |
| Administrator cannot edit records | Authentication, active profile, school scope or RLS policy issue | Verify administrator session and same-school policy |
| A withdrawn record remains visible temporarily | Cached page or stale deployment | Refresh portal and confirm current deployment version |

## 8. Acceptance checklist

- [x] Function created with fixed school scope and public-field allow-list.
- [x] EXECUTE granted to `anon` and `authenticated`.
- [x] Anonymous RPC returned zero rows while zero records were approved.
- [x] Anonymous direct SELECT from the private staff table was denied.
- [x] Frontend calls the RPC and renders only returned public fields.
- [x] Frontend does not fall back to legacy staff data if the RPC fails.
- [ ] An explicitly authorised test record has been published and withdrawn end-to-end.
- [ ] Current hosting deployment has been checked against the latest repository commit.

## 9. Training task

Ask the trainee to explain why an Active staff record is not automatically public, run Test A, explain why Test B must fail, and describe how an administrator can approve and withdraw one staff profile without granting public access to the full staff table.
