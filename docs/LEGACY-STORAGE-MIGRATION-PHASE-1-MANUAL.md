# Legacy Storage Migration — Phase 1 Operational and Training Manual

Repository: `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
Branch: `main`  
Preview: https://samdiok.github.io/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW/  
Supabase project: the existing DE-GLOBAL ACADEMY GBOKO project

## 1. Purpose

This phase begins the controlled replacement of device-specific browser storage with Supabase as the authoritative store for school operational data. It also corrects first-visit navigation so that opening the portal on a new device or browser displays the login choices instead of incorrectly requesting one-time school registration.

This phase is an access and schema-readiness phase. It does not bulk-copy legacy browser data or alter production tables.

## 2. Current phase status

- [x] Identified the legacy `CloudStorage` implementation in `index.html`.
- [x] Identified the legacy stores: `window.storage`, IndexedDB (`EResultDB`), and `localStorage`.
- [x] Identified temporary `sessionStorage` usage for a password-reset operation lock.
- [x] Changed application startup so the login view is the default on every device; local browser data no longer controls whether the one-time setup view appears.
- [x] Added a read-only Supabase schema and security inventory script.
- [ ] Run the schema inventory in Supabase SQL Editor and review its complete output.
- [ ] Reconcile each legacy key with a verified Supabase table, RPC or Storage bucket.
- [ ] Back up legacy data from the original browser/device where it still exists.
- [ ] Migrate, read back and reconcile each data category.
- [ ] Remove each legacy read/write path only after its category passes acceptance tests.

## 3. Roles and permissions

- **School administrator:** runs the read-only schema inventory in the authorised Supabase project, supplies the result sets, confirms which legacy records are authoritative, and approves production migration.
- **Developer/maintainer:** maps data structures, prepares migration SQL and application changes, validates RLS and tests the workflows.
- **Form Masters, subject teachers and students:** continue using their assigned login types. They do not run migration SQL or receive access to the migration process.

Never use a service-role key in browser code. Do not disable RLS to make a migration work.

## 4. First-visit login behaviour

### Previous behaviour

The startup routine used the browser-local `school:main` key to choose between the setup screen and the login screen. A different browser/device naturally has no copy of that key, so it could display the one-time setup form even though the school already exists in Supabase.

### Current behaviour

The setup view is hidden and the login view is shown on startup, regardless of whether the browser has a local school cache. Any cached school branding is optional only and cannot gate access.

### Verification

1. Open the deployed preview in a private/incognito tab or a different browser/device.
2. Confirm that the page displays the E-Result login screen and the Login Type selector.
3. Confirm the available roles include School Administrator, Form Master, Subject Teacher, Sub-Administrator and Student. Portal Developer remains hidden unless the developer access query parameter is used.
4. Select the appropriate role and sign in with the existing Supabase-backed account credentials.
5. Confirm that a new device does not start a new school-registration flow.

A new device does not inherit another device's signed-in session. Each user must sign in on that device. This is normal and is separate from the school-registration screen problem.

## 5. Read-only schema inventory

Open Supabase Dashboard → SQL Editor. Run the complete script:

`docs/LEGACY-STORAGE-MIGRATION-SCHEMA-AUDIT.sql`

It returns five result sets:

1. Public tables and RLS status.
2. Public table columns and data types.
3. Foreign-key relationships.
4. Existing RLS policies.
5. Storage bucket names and visibility settings.

Save or copy all five result sets and provide them to the developer for mapping. The script is read-only: it does not insert, update or delete data, change policies, or alter schema.

## 6. Legacy storage inventory

The source currently contains these legacy data keys:

- School configuration: `school:main`, `schoolInfo`
- Student cache: `students_meta`, `students_batch_*`
- Academic configuration: `classArms`, `formMasters`, `subjectAssignments`
- Staff/management: `managementStaff`, `subAdministrators`, `schoolStaff`
- Portal content: `portalNews`, `prefects`, `dutyRoster`, `portalSettings`
- Staff portal selections: `portalStaffSelections` (staff database records themselves are already handled separately in Supabase)
- Signatures: `signature_subjects`, `sig_*`
- ID card configuration: `schoolIdCardSettings`
- Developer profile: `portal:developer`
- Preferences: `keyboardStyle:*`, `scoreEntryDirection:*`
- Migration/activation marker: `activationResetV3`

This inventory is a source-code key list, not proof that each key contains current or authoritative data.

## 7. Safe migration procedure

For each data category:

1. Confirm the destination table, columns, keys, relationships and unique constraints from the live schema.
2. Inspect RLS policies for the exact roles that need to read or write the records.
3. Identify the authoritative copy. Supabase records take precedence where they are already complete and verified; legacy browser data must not overwrite them automatically.
4. Export and back up any legacy-only data from the original device before changing the application. Browser storage is not shared across devices and cannot be recovered from GitHub.
5. Prepare a category-specific migration with explicit school scoping, duplicate detection and conflict handling.
6. Run a dry-run count and validation before any writes.
7. Apply the migration only after approval.
8. Read the migrated rows back from Supabase and compare counts, relationships and critical fields.
9. Switch the application module to Supabase reads and writes.
10. Test administrator, Form Master, subject teacher and student access as relevant.
11. Remove that category's legacy persistence only after all tests pass.

Do not create a generic JSON key/value table as a shortcut for students, enrolments, results, permissions or academic records.

## 8. Acceptance criteria

- New browsers/devices show login choices, not first-time registration.
- Existing accounts can authenticate using Supabase.
- No production record is overwritten by a stale browser cache.
- Each migrated category has matching source/destination counts or documented, approved exceptions.
- RLS prevents users from accessing another school's data.
- No staff publication setting is changed by this migration.
- No legacy storage path is removed before read-back and role testing.
- The migration and its validation evidence are recorded in this manual and the migration map.

## 9. Known limitations and safeguards

- The developer cannot directly read the user's browser IndexedDB/localStorage from GitHub. Any legacy-only data must be exported from the original browser/device.
- The developer connection currently provides GitHub repository access, not direct Supabase SQL execution. The schema inventory must therefore be run by an authorised user in Supabase SQL Editor.
- The preview and live portal share the same Supabase project. Any production database write from the preview affects the same school data.
- Staff publication remains on hold. No staff member is to be published for migration testing.
- Temporary UI preferences and short-lived session flags may remain browser-local when they are not shared business records.

## 10. Troubleshooting

**The login form still does not appear on a new device**
- Open the deployed preview URL, not an old saved local HTML file.
- Refresh the page after the GitHub Pages deployment completes.
- Try a private/incognito tab to avoid a stale cached page.
- Confirm the deployed commit contains the startup change.

**Login choices appear, but sign-in fails**
- Check internet connectivity and the Supabase project configuration.
- Confirm the user account is active and has the expected profile role.
- Do not attempt school registration as a workaround.

**A module is empty on a new device**
- This may indicate that the module still reads legacy browser storage. Do not re-enter the records or clear the original device's browser data. Complete the schema and legacy-data migration for that module first.

## 11. Training task

A trainee should open the preview on a browser that has never used the portal, confirm the login screen appears, identify the correct login type, and explain why a new device must not trigger school registration. The trainee must not run any write migration or change staff publication settings.
