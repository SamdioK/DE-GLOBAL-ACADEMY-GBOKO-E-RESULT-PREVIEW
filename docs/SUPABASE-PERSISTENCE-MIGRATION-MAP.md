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

## Legacy storage migration — Phase 2 baseline preparation (2026-11-07)

The user supplied the remaining destination-schema inventory for the core academic tables:
- `schools`: school identity and basic branding/contact fields.
- `students`: admission number, names, gender, guardian details, status, login state and student house.
- `student_enrolments`: student/class/session links, register number, SID and archive metadata.
- `student_passports`: private Storage object path linked to school and student.
- `subjects`: school-scoped subject name/code, active state, section/group and trade/optional flags.
- `teacher_assignments`: school, teacher, class, subject and session links with active state.
- `terms`: school-scoped term name, number and current state.
- `profiles`: role, active state, password-change requirement and account metadata.
- `results`: CA1/CA2/CA3, examination, total, grade, remark, workflow status and timestamps.
- `form_master_student_assessments`: affective/psychomotor ratings, attendance, comment and next-term fees.
- `school_staff_directory`: staff profile and employment fields.

The private `student-passports` Storage bucket is configured for JPEG, PNG and WebP with a 5 MB limit. Do not make it public. Passport migration must preserve private access and use the existing `student_passports.storage_path` relationship.

The source review confirms that `supabase-persistence.js` already contains authenticated, school-scoped, read-only audit helpers for school/class data, data counts, student enrolment integrity, assignment integrity and staff/academic configuration. It also confirms that this persistence foundation does not itself read or write browser storage. The legacy `CloudStorage` path remains active in `index.html`.

### Phase 2 baseline audit file

- [Legacy Storage Migration — Phase 2 Baseline Audit SQL](LEGACY-STORAGE-MIGRATION-PHASE-2-BASELINE-AUDIT.sql)

This is a read-only audit. It checks the known school identity, existing row counts for migration-sensitive tables, unique indexes, destination write policies and structural constraints for students/enrolments/passports. It does not create, alter, insert, update or delete database objects or records.

### Migration gate

The schema inventory alone does not authorise a write migration. Before preparing category-specific import SQL:
1. Confirm the school identity returned by Result 1 of the Phase 2 audit.
2. Review existing row counts and unique indexes to prevent duplicates.
3. Review destination write policies and identify which writes must use existing Edge Functions/RPCs.
4. Export and preserve the original browser's legacy data before any cutover.
5. Reconcile legacy data against existing Supabase rows using stable identifiers and explicit conflict rules.

No data migration has been executed. The original browser data and existing Supabase records remain untouched. Preview and live deployments share the same Supabase project.


## Legacy storage migration — Phase 2B integrity reconciliation prepared (2026-11-07)

The user supplied the complete Phase 2 baseline outputs for the school's known Supabase database:

- School identity confirmed: DE-GLOBAL ACADEMY GBOKO, UUID `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`.
- Baseline counts: 743 students, 743 enrolments, 8 passports, 30 classes, 51 subjects, 1 academic session, 3 terms, 6 assessment configurations, 16 Form Master assignments, 1 teacher assignment, 29 student import batches, 838 import rows, 15 staff directory rows, 0 results and 0 Form Master student assessments.
- Unique indexes, relevant write policies and student/enrolment/passport foreign-key constraints were reviewed from the supplied SQL results.
- Results and assessment tables currently have no records. Result entry must continue through the role- and assignment-restricted workflow. Student import and passport writes remain subject to their existing RLS policies.

### Phase 2B audit files

- [Phase 2B Integrity Reconciliation SQL](LEGACY-STORAGE-MIGRATION-PHASE-2B-INTEGRITY-RECONCILIATION.sql)
- [Phase 2B Integrity Reconciliation Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-2B-INTEGRITY-RECONCILIATION-MANUAL.md)

The new SQL is read-only and contains nine result sections. It checks school identity and totals, active students without active enrolments, cross-school or missing enrolment references, duplicate active student/session enrolments, normalised duplicate admission numbers, passport ownership/updater/path metadata, student profile links, missing active register numbers/SIDs, and class/session distribution.

### Current gate

- Phase 2 baseline schema audit: results supplied and reviewed.
- Phase 2B SQL and training manual: committed to `main`; execution and review pending.
- Data migration: not started.
- Browser legacy storage: must remain intact.
- No database records, schema, indexes, policies or Storage objects have been changed by these documentation commits.

A non-zero audit result is a review item, not permission to delete, merge, archive or overwrite a record. Missing student profile links may be legitimate for students without portal accounts. Passport metadata checks do not prove that the underlying Storage object exists. Any SID repair must use the approved generation workflow. The next gate after Phase 2B review is a backup/export of the original browser's legacy data before any category-specific migration.


## Phase 2B integrity reconciliation — results reviewed (2026-11-07)

The school returned all nine Phase 2B result sets. The identity and totals match the baseline: 743 students, 743 enrolments, 743 active enrolments and 8 passport metadata rows. Results 2–6 returned no rows. Result 8 reported zero active enrolments missing register numbers and zero missing SIDs. Result 9 listed 16 class/session groups whose counts sum to 743; every group had zero missing student, class or session references.

Result 7 returned 742 student records with null `profile_id`. This is an account-link finding, not by itself an academic-record integrity error. Source inspection of `index.html` confirms the normal student admission login flow requires an active `profiles` row with role `student` and a matching `students.profile_id` link. The administrator interface has a separate Create Login action that invokes the `provision-student-account` Edge Function for eligible students. No automatic account creation is performed by this audit.

### Phase 2C follow-up

- [Phase 2C Student Login Readiness Audit SQL](LEGACY-STORAGE-MIGRATION-PHASE-2C-STUDENT-LOGIN-READINESS-AUDIT.sql)
- [Phase 2C Student Login Readiness Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-2C-STUDENT-LOGIN-READINESS-MANUAL.md)

Phase 2C is read-only. It groups students by status, login status, profile-link state and admission-number readiness; reviews linked profile roles/active states/password-change flags; and checks whether any profile is linked to multiple student rows. It does not create accounts or alter records.

### Current migration gate

- Phase 2B core integrity checks: results received and reviewed; no reported issues in the tested enrolment, duplicate, passport-metadata, register-number or SID conditions.
- Student account readiness: 742 missing profile links require an explicit school decision about which students need portal access; no bulk provisioning is authorised.
- Phase 2C account-readiness audit: prepared; execution pending.
- Legacy browser export/backup: not yet performed.
- Legacy data migration: not started.
- No production database records, schema, indexes, policies or Storage objects have been changed by this audit work.

Do not infer that the eight passport objects physically exist from metadata checks alone. Do not infer that all students must have portal accounts. Do not manually insert profiles, set student profile links, generate SIDs or bypass the Edge Function. The next migration stage remains a backup/export of the original browser's legacy data after the account-readiness follow-up is understood.


## Phase 2C student login readiness — results reviewed (2026-11-07)

The school confirmed that **student login accounts are created by the administrator and the login details are given to the respective students**. Student academic records do not automatically require portal accounts.

The four Phase 2C result sets were returned and reviewed:

- 743 active students have nonblank admission numbers.
- 1 active student has login status `created` and a linked profile.
- 742 active students have login status `not_created` and no profile link.
- The one linked profile has role `student`, is active, and has `must_change_password = false`.
- The duplicate-profile-link query returned no rows.

The 742 unlinked records are therefore awaiting administrator-authorised account creation; they are not automatically data-integrity errors. No accounts were created, no profile links were changed, and no student data was modified during this audit.

The administrator must use the existing **Create Login** interface and the server-side `provision-student-account` workflow for each authorised student. Direct profile inserts, manual profile linking, bulk provisioning and password handling in browser storage are prohibited. The deployed Edge Function source and configuration still need review before a wider provisioning exercise.

### Phase 2C files and status

- [Phase 2C Student Login Readiness Audit SQL](LEGACY-STORAGE-MIGRATION-PHASE-2C-STUDENT-LOGIN-READINESS-AUDIT.sql)
- [Phase 2C Student Login Readiness Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-2C-STUDENT-LOGIN-READINESS-MANUAL.md)

**Phase 2C audit: complete.** The account policy and actual aggregate results are recorded in the manual. Account creation remains a separate administrator-controlled activity. The next migration gate is a protected export/backup of legacy data from the original browser/device. Do not clear local browser storage or begin bulk migration until the export is preserved, inspected and reconciled against Supabase.


## Legacy storage migration — Phase 3 classification completed (2026-11-07)

The original-browser backup was received and inspected as a read-only snapshot. It contains 43 localStorage keys and 16 IndexedDB records. All 16 IndexedDB records have matching school-UUID-prefixed localStorage keys and identical values, so they are duplicate copies rather than additional records. The optional `window.storage` interface was unavailable and returned no records; dynamic key families could not be enumerated. The backup is therefore useful but not exhaustive.

### Main classification findings

- The 30 legacy class-arm names are a candidate for comparison with the 30 Supabase classes. All captured class arms are inactive, their Form Master fields are blank, and their student-name/sex slots are empty. The arrays must not be treated as student records.
- The legacy assessment configuration contains 30 class-name entries with CA1 10, CA2 10, CA3 10 and examination 70. Supabase currently has six assessment-configuration rows. Exact session/term/class-level reconciliation is required; no bulk insert or replacement is authorised.
- One legacy Mathematics assignment for BASIC7A has a blank teacher ID. It must be resolved against the authenticated teacher profile and current assignment before comparison with the one existing Supabase teacher assignment.
- Four school-UUID-prefixed legacy staff entries are candidates for comparison with the 15 existing Supabase staff-directory rows. No bulk staff import is authorised.
- The captured student metadata reports zero batches and zero students, and no student batch key or populated class student-name array was captured. Existing Supabase student/enrolment records remain unchanged.
- Seven activity-log entries, one portal-news entry, portal and ID-card settings, a subject signature and a school-stamp image were found. Their destinations, authenticity, publication/permission rules or private Storage handling are not sufficiently established for migration.
- Legacy class password fields were found in the browser snapshot. They are not to be migrated; review whether any remain active and replace them through approved workflows if needed.
- Developer profile data, UI themes, SDP menu state and CodeForge workspace data are excluded from school migration.
- The MAIN namespace is a legacy browser key namespace, not the confirmed school UUID. Do not treat MAIN as a separate school or use it as a Supabase school_id.

### Phase 3 files

- [Phase 3 Legacy Browser Data Classification](LEGACY-STORAGE-MIGRATION-PHASE-3-DATA-CLASSIFICATION.md)
- [Phase 3 Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-3-DATA-CLASSIFICATION-MANUAL.md)

### Current gate

**Phase 3 classification is complete; no data migration was performed.** The original backup and browser data remain preserved, and Supabase records/schema/RLS/Storage remain unchanged.

Next: Phase 3B read-only reconciliation of school identity, classes, assessment configurations, teacher assignment and staff directory against current Supabase rows. Count matches alone do not prove record identity. Any SQL must be run by the authorised user in Supabase SQL Editor. No production write is authorised by this classification.


## Phase 3B read-only reconciliation prepared (2026-11-07)

The next read-only comparison has been prepared for the captured legacy configuration:

- School identity confirmation.
- Exact matching of the 30 legacy class names against school-scoped Supabase classes.
- Detection of duplicate normalised Supabase class names.
- Comparison of six legacy class-level assessment configurations against current Supabase configuration rows, including session, term, score maxima and active state.
- Inspection of current school-scoped teacher assignment IDs and class/subject/session references, without returning teacher names or contact details.
- Staff-directory aggregate counts and column metadata only.

### Phase 3B files

- [Phase 3B Read-only Reconciliation SQL](LEGACY-STORAGE-MIGRATION-PHASE-3B-READ-ONLY-RECONCILIATION.sql)
- [Phase 3B Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-3B-READ-ONLY-RECONCILIATION-MANUAL.md)

The SQL is SELECT-only. It contains no insert, update, delete, DDL, RPC or Storage operation. It does not migrate records and does not authorise a write. The user must run it in Supabase SQL Editor and return the seven labelled result sets. If any SQL error occurs, stop and return the exact error instead of modifying the query by guesswork.

**Current status:** Phase 3 classification is complete. Phase 3B reconciliation is prepared and awaiting the user's seven read-only result sets. The original browser data and all Supabase records remain unchanged.


## Phase 3B read-only reconciliation — results reviewed (2026-11-07)

All seven Phase 3B result sets were returned and reviewed, followed by a read-only teacher profile/directory lookup.

- School identity confirmed: DE-GLOBAL ACADEMY GBOKO, UUID `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`.
- All 30 legacy class names have exactly one matching school-scoped Supabase class. The normalised duplicate check found no duplicate class names.
- Assessment reconciliation initially returned NULL because legacy class levels use names such as `BASIC7` and `SS1`, while Supabase stores `BASIC 7` and `SS 1`. A separate SELECT-only inspection confirmed all six existing active configurations for 2026/2027 First Term. Each has CA1=10, CA2=10, CA3=10, examination=70 and total=100. The six configurations match the legacy maxima; no insert or update is needed.
- One existing BASIC7A Mathematics teacher assignment exists for 2026/2027. The assignment is inactive. A follow-up lookup confirmed the teacher UUID belongs to an active same-school `subject_teacher` profile and a matching active staff-directory record. The legacy teacher ID was blank. Do not activate the assignment solely on this identity match; obtain the authorised administrator's decision and use the existing assignment workflow.
- Staff directory: 15 rows, all 15 linked to profiles, all 15 have email addresses, and none has a staff ID. Staff IDs remain manually entered by the administrator; no automatic ID generation or bulk staff import is authorised.
- The existing `school_staff_directory` schema has the fields needed for later field-level reconciliation. Do not create a duplicate staff table.

### Phase 3B outcome

**Phase 3B read-only reconciliation: complete.** All supplied result sets and the teacher identity follow-up have been reviewed. The only unresolved operational decision is whether the inactive BASIC7A Mathematics assignment should remain inactive or be activated by an authorised administrator. This is separate from the teacher's active profile and staff-directory status.

No database records, schema, RLS policies, Storage objects or browser-local records were changed during Phase 3B. The original backup must remain preserved. No bulk migration is authorised by completion of this audit.

### Next gate

Proceed to a category-specific migration design and validation plan only after identifying the next legacy data category and its authorised destination/workflow. Preserve existing classes and assessment configurations; do not recreate them. Resolve the Mathematics assignment status through the normal administrator workflow if required. Keep staff IDs manual. Every future migration must include a dry run, conflict handling, read-back reconciliation, role-based tests and its own operational/training manual.


## Phase 4A — School identity and academic context validation prepared (2026-11-07)

Phase 4A begins category-by-category migration design with the school profile and academic context. The preserved school-prefixed `schoolInfo` object contains school name (DE-GLOBAL ACADEMY GBOKO), address (Gboko), blank email and phone, session (2026/2027), blank logo/signature/comment fields, and an embedded PNG school-stamp data URL. The `MAIN` namespace remains a legacy browser namespace, not a school identifier.

### Proposed field mapping

- `schoolInfo.name` -> existing `schools.name`, compare only.
- `schoolInfo.address` -> `schools.address`, compare and require administrator confirmation before any correction.
- `schoolInfo.email` and `schoolInfo.phone` -> existing `schools.email` and `schools.phone`; blank legacy values must never clear populated destination fields.
- `schoolInfo.session` -> compare with the existing school-scoped `academic_sessions.name`; do not duplicate session state in `schools`.
- Legacy term identity is not supplied by this object; use existing `terms` rows and an explicit administrator decision for current term.
- Logo/signature/stamp assets remain deferred. Do not store base64 data in URL columns; any later asset migration requires private Storage design, metadata and scoped access.

Source inspection confirms that the current frontend still loads `schoolInfo` from `CloudStorage` and writes it through `saveAllData()`. The existing `supabase-persistence.js` helper includes an authenticated, school-scoped read of the `schools` row but no school-profile update method. Thus school-profile editing is not yet proven to be Supabase-persistent.

### Phase 4A files

- [Phase 4A School and Academic Context — Read-only SQL](LEGACY-STORAGE-MIGRATION-PHASE-4A-SCHOOL-ACADEMIC-CONTEXT.sql)
- [Phase 4A School and Academic Context — Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-4A-SCHOOL-ACADEMIC-CONTEXT-MANUAL.md)

The SQL is SELECT-only and returns five labelled result sets: current school row, academic sessions, terms, schema column inventory, and RLS state/policies for `schools`, `academic_sessions`, and `terms`. It performs no insert, update, delete, DDL, RPC or Storage operation.

**Current status:** Phase 4A validation package prepared and committed. Await the user's five result sets and school administrator decisions on the official address/contact values and current session/term. No write migration or frontend persistence change is authorised yet.


## Phase 4B — Administrator authorisation audit prepared (2026-11-07)

Source review of the current frontend and persistence helper confirms that the login flow recognises the `administrator` role through the authenticated profile role and `profile_roles` records. The persistence foundation validates that a user is authenticated and can resolve an active school-linked profile, but its generic update helper is not a sufficient school-profile authorisation boundary. The previously reviewed RLS output shows authenticated SELECT policies only for `schools`, `academic_sessions` and `terms`; no school UPDATE permission is established.

The repository root contains no Supabase Edge Function source or deployment configuration for a school-profile update function. The deployed backend implementation must not be assumed. Before choosing an update mechanism, inspect existing policies, role/permission table columns, database helper-function definitions/settings and triggers.

### Phase 4B files
- [Phase 4B Administrator Authorisation Audit SQL](LEGACY-STORAGE-MIGRATION-PHASE-4B-ADMIN-AUTHORIZATION-AUDIT.sql)
- [Phase 4B Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-4B-ADMIN-AUTHORIZATION-AUDIT-MANUAL.md)

The four SQL result sections are SELECT-only. They inspect identity/role policies, role/permission schema, relevant public helper functions and school/academic triggers. No records, schema, policies, functions or Storage objects are changed.

### Completion gate
Phase 4B is prepared and awaiting all four result sets. Do not create an UPDATE policy, deploy an Edge Function, alter frontend save behaviour or execute write SQL until the results are reviewed. The final design must restrict the update to approved school profile fields, the caller's own school, and an active administrator role, with server/database enforcement and negative tests for non-administrator and cross-school access.


## Phase 4B — Administrator authorisation audit results reviewed (2026-11-07)

The four Phase 4B result sets were supplied and reviewed.

- Existing `schools`, `academic_sessions` and `terms` policies show authenticated SELECT only; no school UPDATE policy is present.
- The role schema includes `profile_roles.is_active`; the role/permission tables do not establish a separate active flag on `permissions` or `role_permissions`.
- The existing `public.has_role(required_role)` SECURITY DEFINER helper checks an active caller profile and either the active primary profile role or an active matching `profile_roles` row. Its body schema-qualifies the referenced objects and `auth.uid()`; its configured search_path is `public`.
- `public.has_permission(required_permission)` similarly checks active profiles and active secondary role assignments against role-permission mappings.
- `public.current_user_role()` returns only the primary `profiles.role`; it does not represent all active secondary roles. A future policy that intends to recognise secondary roles should use the reviewed `has_role` helper rather than relying only on `current_user_role`.
- The final trigger query returned no rows for `schools`, `academic_sessions` and `terms`.

The role helper is not a complete school-profile authorisation policy by itself. Any update must additionally require that the target `schools.id` equals the active caller profile's `school_id`, and must restrict the update to an approved list of columns. No write policy, grant, function, record or frontend save path was changed during Phase 4B.

### Phase 4B outcome

**Administrator role model identified; write path remains unauthorised.** The next inspection must establish table-level and column-level privileges, RLS enabled/forced state, helper function execute grants and school constraints before selecting a narrow direct-RLS design or a server-side function.

### Phase 4C files

- [Phase 4C School Privilege Audit SQL](LEGACY-STORAGE-MIGRATION-PHASE-4C-SCHOOL-PRIVILEGE-AUDIT.sql)
- [Phase 4C Operational and Training Manual](LEGACY-STORAGE-MIGRATION-PHASE-4C-SCHOOL-PRIVILEGE-AUDIT-MANUAL.md)

Phase 4C is SELECT-only and awaits six result sets. Do not execute grants, revokes, policies or data updates until the privilege and RLS design is reviewed.


## Phase 4C — School privilege audit results reviewed (2026-11-07)

The user supplied all six Phase 4C result sets.

- `public.schools` has table-level grants for `anon` and `authenticated`, including INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER; none is grantable onward.
- The column privilege view reports the same broad effective column access, reflecting the table-level grants.
- RLS is enabled and not forced; the table owner is `postgres`.
- The existing role helpers `has_role`, `has_permission` and `current_user_role` are SECURITY DEFINER with `search_path=public`; EXECUTE is available to PUBLIC, anon and authenticated.
- The reviewed `has_role` function checks an active profile and active primary or additional role, but a school UPDATE policy must separately verify that the active caller profile belongs to the exact target school.
- The only reported school constraint is the primary key on `id`.

The earlier Phase 4B audit found authenticated SELECT policy access and no school UPDATE policy. Therefore broad SQL grants do not by themselves establish that ordinary authenticated updates currently pass RLS. The broad grants are nevertheless excessive and must be narrowed before a profile write path is enabled.

No database changes were made during Phase 4C.

## Phase 4D — Secure school profile update migration prepared (2026-11-07)

Files:
- [Phase 4D secure school profile update SQL](LEGACY-STORAGE-MIGRATION-PHASE-4D-SECURE-SCHOOL-PROFILE-UPDATE.sql)
- [Phase 4D operational and training manual](LEGACY-STORAGE-MIGRATION-PHASE-4D-SECURE-SCHOOL-PROFILE-UPDATE-MANUAL.md)

The proposed transactional SQL:
- Revokes direct table privileges from anon on `public.schools`.
- Removes broad authenticated INSERT, UPDATE, DELETE and administrative table privileges while retaining authenticated SELECT.
- Grants authenticated UPDATE only on `name`, `address`, `phone`, `email`, `logo_url`, `motto` and `updated_at`.
- Adds an UPDATE RLS policy requiring `public.has_role('administrator')` and an active profile whose `school_id` matches the target school, for both USING and WITH CHECK.
- Returns four verification result sets after the transaction.

**Status:** SQL and manual prepared and committed; execution and verification pending. Do not connect the school profile form to writes until the user returns all four verification outputs. This phase does not migrate other legacy browser data or remove local storage.


## Supabase-first migration — Phase 5A architecture baseline (2026-11-07)

A fresh source inspection of `index.html` and `supabase-persistence.js` confirmed that the legacy `CloudStorage` class is still active. Its save/load methods use optional `window.storage`, IndexedDB and `localStorage`; they do not persist through Supabase. `saveAllData()` still writes multiple permanent data categories through this legacy layer. The Staff Database remains the identified separate Supabase-backed screen.

The target architecture, category-by-category sequencing, Storage design requirements, cutover checklist, safety rules and Phase 5B/5C gates are documented in:

- [Phase 5A — Supabase-First Persistence Architecture and Migration Work Plan](SUPABASE-FIRST-PERSISTENCE-PHASE-5A-ARCHITECTURE.md)
- [Phase 5A — Supabase-First Persistence Operational and Training Manual](SUPABASE-FIRST-PERSISTENCE-PHASE-5A-MANUAL.md)

**Phase 5A status:** architecture and migration plan documented; no database, Storage bucket, RLS, browser data or production application behaviour changed.

**Next gate:** before any Phase 5B production write, inspect Supabase migration history and verify whether the prepared Phase 4D secure school-profile update migration has already been applied. Do not blindly apply it. Then verify actual school table grants/RLS and build the narrow school-profile persistence path.

The preview and live site share the same Supabase project. All production writes require backup, explicit approval, read-back reconciliation and role/device testing.

## Phase 5B — School profile pre-flight audit prepared (2026-11-07)

A source review confirms the current School Information form still writes its school profile, logo, principal signature, stamp and stamp signature through the legacy browser-storage path. The form combines several domains: school identity belongs in `schools`, session belongs in `academic_sessions`, principal identity needs a verified staff/profile relationship, and image assets require Supabase Storage with private access policies. No direct Supabase school-profile write path has been implemented.

The prepared Phase 4D migration is present in the repository, but its execution status is not established by source control. The production migration history and live grants/policies must be reconciled before the migration or frontend update path is considered.

### Phase 5B pre-flight files
- [Phase 5B Read-only Pre-flight SQL](SUPABASE-FIRST-PERSISTENCE-PHASE-5B-PREFLIGHT-AUDIT.sql)
- [Phase 5B Read-only Pre-flight Operational and Training Manual](SUPABASE-FIRST-PERSISTENCE-PHASE-5B-PREFLIGHT-MANUAL.md)

The SQL checks migration-history table/version status, table and column grants, RLS policies and state, actual school columns, and the known school row. It performs no writes. A missing migration-history table is explicitly treated as UNKNOWN, not proof that Phase 4D is unapplied. Reconcile with the linked CLI migration list; do not run `db push` or the Phase 4D migration during this audit.

**Current status:** pre-flight package prepared. No Supabase database, Storage, browser data or application behaviour changed. Await all SQL results and the linked CLI migration-list output before designing the narrow school-profile update integration.


### Phase 5B audit results received — corrected Phase 4D required

The operator supplied live audit output. The school row exists and matches the expected UUID. RLS is enabled (not forced); the only listed policy is authenticated SELECT. Table-level grants query returned no rows for anon/authenticated, but column-level grants show INSERT, REFERENCES, SELECT and UPDATE for both roles across the school columns. The CLI migration list shows local version `20261107120000` with no remote version; the standard migration-history table lookup returned NULL. This is not proof that the migration was never manually executed.

The original Phase 4D SQL only revoked table-level privileges and therefore did not explicitly clear the existing column-level grants. A corrected script has been prepared to revoke table and column grants before regranting authenticated SELECT and UPDATE on the approved seven profile fields. Do not execute the earlier draft. Corrected SQL remains pending operator review and explicit approval. No database changes have been made.
