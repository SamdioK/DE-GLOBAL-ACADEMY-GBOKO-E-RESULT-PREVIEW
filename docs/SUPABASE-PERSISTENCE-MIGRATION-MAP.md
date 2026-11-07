# Supabase Persistence Migration — Data Mapping and Safety Audit

Repository: `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
Working branch: `main`  
Preview URL: `https://samdiok.github.io/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW/`  
Audit date: 2026-11-06

## Status

- Preview deployment: GitHub Actions run `42285393666` completed successfully on 2026-11-06.  
- `supabase-persistence.js` provides authenticated Supabase CRUD helpers.
- `index.html` loads that helper after the Supabase JS client and initialises it after creating `supabaseClient`.
- The legacy `CloudStorage` implementation is intentionally still active.
- No database schema, RLS policy, production branch, or existing browser data has been changed.
- This document is an implementation map, not an instruction to bulk-copy legacy JSON into relational tables.

## Storage mechanisms found

The application currently uses:
- `window.storage` when available;
- IndexedDB database `EResultDB`, object store `data`;
- `localStorage` fallback;
- `sessionStorage` for a temporary password-reset operation lock.

The current `CloudStorage.save()` and `globalSave()` return success when any browser-side backend succeeds. They do not write to Supabase. The current `load()` methods read browser-side stores in priority order. Therefore a successful legacy save is not evidence of cloud persistence.

## Legacy key inventory and proposed destinations

| Legacy key / data | Existing Supabase destination or proposal | Migration decision |
|---|---|---|
| `school:main`, `schoolInfo` | `schools` | Map only confirmed school columns. Logo/signature data needs Storage or dedicated metadata; do not write base64 blobs into URL columns. |
| `classArms` | `classes` | Normalise each class/arm to `school_id`, `level`, `arm`, `class_name`. Legacy arrays such as student name/sex slots are not class rows and must not be copied into this table. |
| `formMasters` | `profiles`, `profile_roles`, `form_master_assignments` | Use existing authenticated account/provisioning workflows. Never write passwords or create duplicate Auth users from the browser. |
| `subjectAssignments` | `teacher_assignments` | Resolve teacher, class, subject and academic-session UUIDs; preserve active assignment state and existing access checks. |
| `students_batch_* / students_meta` | `students`, `student_enrolments` and import tables | Use existing student import/approval RPC workflow. Do not bulk upsert around import approval or SID generation. |
| `managementStaff`, `schoolStaff`, `staffDatabase` | `school_staff_directory` | Reconcile duplicate legacy arrays and profile links first. Confirm write RLS policies before enabling writes. |
| `portalStaffSelections` | `school_staff_directory.show_on_portal` and possibly a future field-selection table | Preserve selected public fields; the current directory boolean alone may not represent all per-field choices. |
| `subAdministrators` | `profiles`, `profile_roles`, `role_permissions` | Must use authenticated administrator provisioning and role/permission workflows, not arbitrary client-side role writes. |
| `activityLog` | No confirmed audit-log table in the supplied 30-table inventory | Requires a dedicated append-only audit table and RLS design, or a verified existing audit destination. |
| `portalNews` | No confirmed news/announcements table in supplied inventory | Requires a new table and public-read/admin-write policy design. |
| `prefects` | No confirmed prefect table in supplied inventory | Requires a new table and publication/access policy design. |
| `dutyRoster` | No confirmed duty-roster table in supplied inventory | Requires a new table and school-scoped policies. |
| `portalSettings` | No confirmed portal-settings table in supplied inventory | Requires a school-scoped settings table; developer licensing fields need separate authority and must not be trusted from a public client. |
| `sig_*`, `signature_subjects` | Supabase Storage plus metadata | Define a private bucket/path, owner permissions, content type/size checks and metadata schema before migration. |
| `schoolIdCardSettings` | No confirmed table in supplied inventory | Requires a school-scoped configuration table and admin-only policies. |
| `portal:developer` | Authenticated developer profile / secure developer settings | Do not store developer identity, subscription controls or access grants as browser-global data. Require server-side authorisation. |
| `keyboardStyle:*`, `scoreEntryDirection:*` | Proposed `user_preferences` table | Low-risk per-user settings; table and RLS policy must be created before moving these preferences. |
| `activationResetV3` | Migration/version marker | Keep as a one-time migration marker until its old behaviour is fully retired; do not copy it as application business data. |
| `sessionStorage` password-reset operation lock | Browser session only | Keep ephemeral; it is not durable application data and should not be migrated. |

## Confirmed database tables relevant to the mapping

The supplied schema inventory includes:
- `schools`, `classes`, `academic_sessions`, `terms`, `subjects`;
- `profiles`, `profile_roles`, `permissions`, `role_permissions`;
- `form_master_assignments`, `teacher_assignments`;
- `students`, `student_enrolments`, `student_import_batches`, `student_import_rows`;
- `school_staff_directory`, `student_passports`;
- `results`, `assessment_configurations`, `form_master_student_assessments`;
- student/class change-request tables and related workflow tables.

All 30 supplied public tables were reported to have RLS enabled. RLS being enabled does not prove that a particular insert/update/delete is permitted. The exact write policies for several destination tables remain unverified.

## Critical rules before any write migration

1. Use only the existing Supabase anon/publishable key in browser code. Never expose a service-role key.
2. Keep RLS enabled. Do not weaken or bypass existing policies.
3. Resolve the authenticated user's active profile and school UUID; never trust a school ID supplied only by the browser.
4. Do not directly write privileged profile roles, student enrolments, import approvals, SID values, result statuses, or published results.
5. Use existing Edge Functions and database RPCs for account provisioning, student import approval, enrolment, and result workflow.
6. Keep browser-local data intact until the corresponding Supabase records have been read back and reconciled.
7. Do not use a generic JSON key/value table as a shortcut for relational school, student, result, or permission data.
8. Test with a non-production/test school or controlled test records before enabling any production write path. The preview and live repositories share the same Supabase project, so database writes affect both.

## Next implementation sequence

1. Verify authenticated profile context and school scoping in the persistence layer.
2. Complete a read-only comparison for `schools` and `classes`, including exact RLS policy checks.
3. Build a dry-run export/validation report for the legacy school and class data.
4. Implement a narrow, administrator-authorised write path only after the destination policies are confirmed.
5. Migrate students only through the existing import/approval workflow.
6. Add and secure any genuinely missing tables before moving news, prefects, rosters, portal settings, audit records or user preferences.
7. Remove browser fallback only after every category has passed reconciliation and multi-role testing.

## Staff directory migration — implementation status (2026-11-06)

The staff directory write policies and table constraints were reviewed before enabling the administrator interface.

### Verified controls

- INSERT, SELECT and UPDATE are restricted to an active administrator profile belonging to the same school.
- No DELETE policy was supplied; the browser interface must not offer staff deletion.
- school_id references schools; profile_id and created_by reference profiles.
- Staff status is constrained to Active, Inactive or Suspended.
- A non-empty staff ID is unique per school after trimming and case folding. Blank staff IDs remain permitted.
- A non-empty email is unique per school after trimming and case folding.
- A profile can be linked to only one staff-directory row per school.

### Implemented on the migration branch

- Added authenticated getStaffDirectory, createStaffDirectoryRecord and updateStaffDirectoryRecord methods in supabase-persistence.js.
- Connected the administrator Staff Database screen to read existing rows from school_staff_directory.
- Staff create and edit actions now use Supabase and return the saved row before updating the interface.
- Status activation/deactivation uses the scoped Supabase update path.
- Removed the Staff Database array from the legacy saveAllData() browser-storage write list.
- The interface does not synthesise legacy Form Master, management or school-staff records into the Supabase staff directory.
- Staff IDs are optional and are not generated automatically.
- Existing profile links are not overwritten during edits.
- Qualification selections are stored as a semicolon-separated text value in the existing qualification column and reconstructed for the form.

### Deliberately deferred

- Staff photo uploads are not yet connected. The Storage bucket policies and upload constraints have not been verified. Selecting a new photo is therefore blocked with an explanatory message; existing photo_url values can still be displayed.
- Per-field portal visibility selections are not migrated. The current show_on_portal boolean is supported, but the legacy per-field selection data requires a separate schema and access review.
- No legacy staff arrays are bulk imported or reconciled automatically.
- No database schema or RLS policy was changed as part of this implementation.

### Required validation before wider use

1. Open the preview branch after its deployment succeeds and sign in as the school administrator.
2. Confirm that the existing 15 Supabase staff rows load; do not create test duplicates among real staff.
3. Use a clearly identifiable test record only if the school administrator authorises a test record. Confirm insert, read-back, edit and status change.
4. Confirm that blank staff IDs remain blank and that duplicate non-empty IDs/emails are rejected by the database.
5. Test with a non-administrator account and confirm the directory is not accessible through the administrator screen.
6. Confirm the public portal's staff display and field-selection behaviour separately before retiring its legacy data path.

The preview and live repositories share the same Supabase project. Any staff write made from the preview portal is a real write to the shared school database.

## Class configuration reconciliation — implementation status (2026-11-06)

- Added `auditClassConfigurationReconciliation` to `supabase-persistence.js`.
- The audit reads the authenticated school's `classes`, `form_master_assignments` and `teacher_assignments` rows under existing RLS.
- The administrator dashboard now compares Supabase class names with the legacy `classArms` names and reports unmatched names, duplicate Supabase class names and assignment counts.
- The audit is strictly read-only. It does not change class rows, assignments, enrolments or browser storage.
- The legacy `classArms` object remains the active UI model for now because it contains additional fields (Form Master display name, activation state and legacy student-name arrays) that do not map directly to the `classes` table.
- Do not replace `classArms` with Supabase class rows until the separate assignment and student-enrolment workflows have been mapped and tested.


## Staff database completion and public profile safeguards (2026-11-06)

- Added a live completeness summary to the administrator Staff Database view. It reports populated counts for staff ID, gender, designation, department, qualification, specialisation, employment type and date employed.
- The summary is calculated from the 15 (or current number of) rows loaded from Supabase. It does not write to the database or invent missing values.
- Staff IDs remain optional and manually administered, as instructed. No automatic ID generation has been introduced.
- Administrators may save incomplete records while keeping them unpublished, so existing records can be completed gradually from verified information.
- When an administrator enables public portal visibility, the form now requires gender, designation, department, employment type and at least one qualification (or a preserved legacy qualification). Missing requirements are reported before saving.
- Qualification selection is limited to a maximum of eight options.
- The existing status and public visibility controls remain administrator-controlled. No existing staff records were bulk edited or published by this code change.
- Public visibility remains false until an administrator explicitly enables it on an individual record.


## Staff Database training documentation

The administrator operating procedures, field definitions, manual completion workflow, publication safeguards, validation, troubleshooting and practical training exercise are documented in [Staff Database — Administrator Operational and Training Manual](STAFF-DATABASE-ADMIN-TRAINING-MANUAL.md). This manual applies to the current Supabase-connected Staff Database implementation and records its known limitations.


## Staff Database security review (2026-11-06)

- Added a source-code security and access review in [Staff Database — Security and Access Audit](STAFF-DATABASE-SECURITY-ACCESS-AUDIT.md).
- Changed default public staff-profile fields to a privacy-first selection. Contact details, photographs and employment dates require separate administrator selection.
- The change does not rewrite existing saved portal field selections or any staff records.
- The audit records remaining live negative tests and the future narrowly scoped public-directory read path. Do not weaken private staff-directory RLS to implement public display.


## Public staff directory — secure read-path design (2026-11-06)

- Added [Public Staff Directory — Secure Read-Path Design](PUBLIC-STAFF-DIRECTORY-SECURE-READ-PATH.md).
- The design proposes anonymous read access only to an explicit allow-list of public profile columns and only for records with Active status and `show_on_portal = true`.
- It explicitly prohibits broad anonymous table access, public access to contact details and private metadata, and use of a service-role key in the browser.
- The design includes a proposed SQL migration, frontend integration requirements, positive and negative acceptance tests, and a rollback plan.
- **No SQL was executed and no Supabase grants, RLS policies, schema or staff records were changed.** The migration requires review and approval before execution.

## Legacy storage migration — Phase 1 update (2026-11-07)

A source-code inventory confirmed that the legacy `CloudStorage` implementation remains active. It still uses `window.storage`, IndexedDB (`EResultDB`) and `localStorage`; the temporary password-reset operation lock also uses `sessionStorage`. The source contains 75 calls to the legacy CloudStorage API and the following key families: school configuration, student batches, class arms, Form Masters, subject assignments, management staff, sub-administrators, portal news, prefects, duty roster, portal settings, signatures, ID-card settings, developer profile and score-entry preferences.

The legacy persistence path has **not** been removed. Its remaining data categories require a verified destination schema, RLS review, original-device backup where data exists only in browser storage, migration, read-back reconciliation and role-based acceptance tests.

### New-device login correction

The former startup routine used the browser-local `school:main` key to decide whether to show one-time school setup or the login form. This made a new browser/device appear unregistered even though the school is already provisioned in Supabase.

The startup routine has been changed so that the login view is always the default and the setup view is hidden. Any local school configuration is optional branding cache only and cannot control access to the login screen. Each user still signs in separately on each device; Supabase sessions are not copied from one device to another.

### Phase 1 files

- [Legacy Storage Migration — Phase 1 Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-1-MANUAL.md)
- [Read-only Supabase Schema Audit SQL](LEGACY-STORAGE-MIGRATION-SCHEMA-AUDIT.sql)

The SQL inventory must be run by an authorised user in Supabase SQL Editor. It retrieves public table/column metadata, foreign keys, RLS policies and Storage bucket settings. It performs no writes.

### Current status and next gate

- New-device login code correction: committed; deployment and live cross-device verification pending.
- Schema and RLS inventory: prepared; awaiting the five result sets from Supabase.
- Data migration: not yet executed. No production data has been copied, overwritten or deleted.
- Legacy storage removal: not yet authorised or safe.

Do not proceed with bulk student/result migration until the actual destination schema, existing Supabase counts, source-device legacy export and conflict rules have been reviewed. The preview and live sites share the same Supabase project.
