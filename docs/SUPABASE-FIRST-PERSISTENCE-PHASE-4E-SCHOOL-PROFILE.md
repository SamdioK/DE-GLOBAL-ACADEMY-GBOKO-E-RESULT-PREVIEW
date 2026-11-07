# Supabase-First Persistence — Phase 4E: School Profile

## Purpose

Connect the School Information screen's core identity fields to the authenticated school's row in `public.schools`. Supabase is the authoritative source for school name, address, phone and email. This phase does not migrate images, principal identity or academic session configuration.

## Database and access

- Read the current user's active `profiles` row to obtain the school ID.
- Read `schools` using that server-linked school ID; do not accept a school ID from browser form data.
- Update only `name`, `address`, `phone` and `email` from this screen.
- The database RLS policy `schools_admin_update_own_school` remains the final authorisation boundary. It requires an active administrator whose profile belongs to the same school.
- The browser client uses the Supabase anon/publishable key and the authenticated user's session. Never use a service-role key in frontend code.

## Interface behaviour

1. On loading School Information, the screen reads the authoritative school profile from Supabase.
2. School name, email, phone and address are editable.
3. Principal name is read-only until a verified staff/profile relationship is implemented.
4. Academic session is read-only and comes from the active academic session.
5. School identity save calls the narrow `updateSchoolProfile` method. The interface updates its in-memory values and shows success only after Supabase returns the updated row.
6. If the update fails or RLS denies it, the screen reports failure and does not present unsaved values as persisted.
7. The save operation does not call the legacy `saveAllData()` routine.

## Validation and expected outcomes

- A valid school administrator can read the school's row and update the four permitted identity fields.
- A non-administrator or a user linked to another school cannot update this school's row; the RLS policy must deny the operation.
- School name is required. Email is validated when supplied. Input lengths are constrained in the client helper.
- The school ID is derived from the authenticated profile, not supplied by the interface.
- The returned row must be present; a zero-row update is treated as failure.
- Reloading the application should display the values read from Supabase.

## Deferred fields and files

- Academic session remains in `academic_sessions` and is not written to `schools`.
- Principal name must be linked to a verified staff/profile record before it becomes editable here.
- School logo, principal signature, stamp artwork and stamp signature require Supabase Storage bucket and object-policy verification. Their upload controls are temporarily disabled in this screen. Existing browser-side artwork is not deleted by this phase.
- No student, staff, class, assessment, result or enrolment rows are imported, updated or deleted by this phase.

## Operator test

1. Sign in with an authorised School Administrator account.
2. Open **School Information** and confirm the displayed name, address, phone and email match the Supabase school row.
3. Save the unchanged values first. Confirm a success message appears.
4. Refresh the page and confirm the same values load again.
5. If testing a changed value, record the original value first, change one field, save, refresh, confirm persistence, then restore the original value and verify again.
6. Sign in with a non-administrator account and confirm the School Information editing screen is not available. Do not attempt to bypass role restrictions.
7. Report any error message without sharing passwords, access tokens, database URLs or secret keys.

## Rollback

This frontend change does not alter the database schema or existing school data. If the screen malfunctions, revert the frontend commits for `index.html` and `supabase-persistence.js`; do not revoke or remove the verified Phase 4D RLS policy as a troubleshooting shortcut.
