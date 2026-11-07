# Public Staff Directory — Operational and Training Manual

**Project:** DE-GLOBAL ACADEMY GBOKO E-Result Portal  
**Module:** Public Staff Directory  
**Audience:** School Administrator, Portal Developer and staff-directory trainees  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Updated:** 7 November 2026

## 1. Purpose

The Public Staff Directory displays only staff profiles approved by the school. It reads from the Supabase RPC function `get_public_school_staff_directory`, not from the private staff table or the legacy browser-storage staff list.

The directory is deliberately empty until an administrator approves at least one staff record.

## 2. Roles and responsibilities

### School Administrator
- Verifies staff information against authorised school records.
- Confirms that publication is appropriate and authorised.
- Sets the staff record to Active.
- Enables or disables **Show on School Portal** for each record.
- Reviews the public portal after approving or withdrawing a profile.

### Portal Developer / Database Administrator
- Maintains the RPC function, its fixed school scope and output allow-list.
- Maintains the anonymous EXECUTE grant without granting anonymous direct table access.
- Investigates RPC or hosting errors.
- Does not publish staff records on behalf of the school without authorisation.

### Public visitor
- Can view only profiles returned by the public RPC.
- Cannot query the private staff table directly or access staff contact/account details through this directory.

## 3. Public fields

The current function returns:
- Name
- Photograph URL
- Designation
- Department
- Qualification
- Specialisation / Subject

It does not return phone number, email, staff ID, profile ID, gender, employment date, biography, creator information, school ID, status or publication flag.

The returned `id` is a technical row identifier and is not displayed as a public profile detail.

## 4. Administrator publication procedure

1. Sign in to the E-Result Portal using the authorised school administrator account.
2. Open **Staff Database**.
3. Search for the staff member. Do not create another record if one already exists.
4. Open the record for editing.
5. Verify the person's name and all information intended for display.
6. Confirm that the person is authorised for publication under the school's process.
7. Set **Account Status** to **Active**.
8. Enable **Show on School Portal**.
9. Save the record and wait for the success confirmation.
10. Open or refresh the public School Portal.
11. Confirm that the staff profile appears and that only the approved public fields are shown.

An Active record is not automatically public. The publication flag must also be true.

## 5. Withdrawing a profile

1. Open **Staff Database** as an authorised administrator.
2. Find the staff record.
3. Disable **Show on School Portal**, or change the status from Active where appropriate.
4. Save the change.
5. Refresh the public portal and confirm that the profile is no longer displayed.

The RPC filters on every request. A record with `show_on_portal = false`, or a status other than `Active`, is excluded.

## 6. Public visitor workflow

1. The visitor opens the School Portal.
2. The portal requests the public directory through `supabaseClient.rpc('get_public_school_staff_directory')`.
3. Supabase applies the function's fixed school UUID and publication filters.
4. The portal renders the returned name, photograph URL, designation, department, qualification and specialisation.
5. If there are no approved records, the portal displays **No staff profiles are currently published**.
6. If the request fails, the portal displays **The staff directory is temporarily unavailable**. It does not fall back to legacy browser-stored staff data.

## 7. Security and privacy rules

- Never grant `anon` direct SELECT on `public.school_staff_directory`.
- Never put a Supabase service-role key in browser code.
- Do not add phone, email, employment date or biography to the public RPC without a new privacy and approval review.
- Do not accept an arbitrary school ID from the browser as the security boundary.
- Keep the RPC fixed to the authorised school UUID and retain its Active and publication filters.
- Keep the function owner trusted because it runs as `SECURITY DEFINER`.
- Do not remove RLS from the private staff table.
- Do not publish a staff member merely to test the interface.

## 8. Validation and expected outcomes

Current verified baseline:
- 15 staff records
- 15 Active records
- 0 records approved for publication
- 0 profiles visible through the anonymous RPC
- Direct anonymous SELECT from the private staff table is denied

### Anonymous RPC test

```sql
BEGIN;
SET LOCAL ROLE anon;
SELECT COUNT(*) AS publicly_visible_staff
FROM public.get_public_school_staff_directory();
ROLLBACK;
```

Expected current result: `0`.

### Direct table access test

```sql
BEGIN;
SET LOCAL ROLE anon;
SELECT COUNT(*) AS direct_staff_table_access
FROM public.school_staff_directory;
ROLLBACK;
```

Expected result: permission denied (SQLSTATE `42501`). This is a successful security outcome.

### Approved test record

Only use a test record or a staff record with explicit publication authorisation. After approval, confirm the RPC returns only that record and the allow-listed columns. Withdraw approval and confirm the RPC returns zero again.

## 9. Troubleshooting

| Problem | What to check |
|---|---|
| No staff profiles are currently published | Confirm whether any record is both Active and approved for portal display |
| Staff directory temporarily unavailable | Check browser console, Supabase connection, RPC existence and EXECUTE grants |
| Administrator cannot approve a record | Check administrator authentication, active profile, school scope and RLS policy |
| A withdrawn profile still appears | Refresh the portal and confirm the latest frontend deployment is active |
| Direct table query is denied | Expected. Do not grant anon SELECT |

## 10. Training exercises

1. Explain why Active status alone does not make a staff member public.
2. Identify the six public profile fields and name at least five private fields excluded from the RPC.
3. Run the anonymous RPC test and explain why the current result is zero.
4. Run the direct table access test and explain why permission denied is correct.
5. Describe the administrator steps for approving and withdrawing a staff profile.
6. Explain why a public directory failure must not fall back to legacy browser storage.

## 11. Completion criteria

This module's database and frontend integration checks are recorded as passed for the current baseline. Full operational sign-off still requires an authorised end-to-end publication and withdrawal test and confirmation that the deployed hosting site is serving the latest repository version.
