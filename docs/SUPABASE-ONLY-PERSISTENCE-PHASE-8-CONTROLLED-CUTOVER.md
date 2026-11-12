# Phase 8 — Supabase-only persistence cutover and reconciliation

**Date:** 12 November 2026  
**Project:** DE-GLOBAL ACADEMY GBOKO E-RESULT SYSTEM  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Supabase project:** `rvmcqvfuioxmbtvgdptb`  
**Mode:** Live schema/data reconciliation plus a limited non-destructive application cutover.

## 1. Safety and scope

This phase continues the six workstreams in the storage audit. It does not delete legacy JSON rows, browser records, Storage objects, staff/student records, or historical data. The active deployed application and preview share the production Supabase project; therefore no synthetic production records were created for testing.

The current application persistence abstraction `CloudStorage` writes to Supabase Postgres table `school_app_state`, not to browser storage. References to LocalStorage, IndexedDB and `window.storage` are retained only in the one-time legacy migration reader/cleanup routine. No active `localStorage.setItem`, `sessionStorage` or browser-store write fallback was found in the inspected `index.html`. The standalone `legacy-browser-backup.html` remains a read-only recovery/export utility.

## 2. Live inventory

School ID: `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`.

| Object | Live rows / objects |
|---|---:|
| `classes` | 30 |
| `form_master_assignments` | 17 |
| `teacher_assignments` | 18 |
| `school_staff_directory` | 15 |
| `school_app_state` | 15 keys |
| `school_portal_settings` before cutover | 0 |
| `school_portal_news` | 0 |
| `school_prefect_appointments` | 0 |
| `school_duty_roster` | 0 |
| `school_portal_staff_selections` | 0 |
| `school_id_card_settings` | 0 |
| `school_teacher_signatures` | 2 |
| Storage: `student-passports` (private) | 8 objects |
| Storage: `school-private-assets` (private) | 10 objects |
| Storage: `school-public-assets` (public) | 1 object |

The 15 `school_app_state` keys occupy approximately 5.8 KB. The `students_meta` record reports zero batches and zero legacy students. Official student and enrolment records remain in the relational `students` and `student_enrolments` tables.

## 3. Workstream outcomes

### 3.1 Students, classes and subject assignments

- The live relational tables already contain 30 classes, 17 Form Master assignments and 18 subject-teacher assignment rows.
- The `classArms` JSON snapshot contains 30 class names and legacy empty student-name/sex arrays. It must not be imported as a second class or student roster.
- The `subjectAssignments` JSON snapshot contains 18 records with UUIDs that correspond to the relational assignment domain. It includes stale denormalised teacher labels such as “Staff profile unavailable” and inactive teacher metadata. The relational assignment rows remain authoritative; do not copy stale labels or change activation status from the JSON snapshot.
- The `students_meta` record reports zero legacy batches. No student batch import was performed.
- Application paths still read/write some class/assignment configuration JSON for legacy UI compatibility. This is Supabase database storage, not browser storage, but it remains a duplicate representation requiring a separate UI cutover and acceptance test.

### 3.2 Staff directory

- `school_staff_directory` contains 15 records.
- The `staffDatabase` JSON snapshot contains only one legacy administrator-like record with a generic identifier, not a stable matching identifier for any one of the 15 directory rows.
- The old record was not inserted or merged. Doing so could create a duplicate staff member or overwrite a verified directory record.
- The relational staff directory remains the authoritative staff record destination. Legacy display snapshots remain in `school_app_state` until all UI consumers have been cut over and reconciled.

### 3.3 Portal news, prefects, duty roster and portal staff selections

- Dedicated school-scoped tables already exist for all four domains.
- Their live row counts are zero.
- The legacy `portalNews` JSON contains one placeholder-looking item (title “Gjdndn” and message “Hsdbsndbdb”). It was not published or migrated.
- Legacy prefect, duty-roster and portal-staff-selection arrays are empty.
- No fabricated rows were created. The application still has legacy JSON read/write consumers in some administrator/public portal paths; those must be converted to dedicated table adapters before legacy JSON keys can be retired.

### 3.4 Portal settings — cut over

- The legacy `portalSettings` record mixed school settings with privileged licensing/sales metadata.
- Only school-owned fields were migrated: `portal_enabled=true`, `welcome_enabled=true`, the existing welcome text, and `term_weeks=12`.
- Licensing dates, sales entries and other platform/developer metadata were deliberately excluded.
- A school row was inserted into `school_portal_settings` and read-back confirmed.
- The application now reads the relational portal settings table for all authenticated roles.
- `saveAllData()` now upserts the dedicated `school_portal_settings` row and verifies the returned school ID. It no longer saves a competing `schoolInfo` JSON snapshot; school identity is read from `schools`.

### 3.5 School branding, stamps and signatures

- Existing logo, stamp and signature assets already have Storage object paths in the existing buckets.
- Current buckets are correctly classified: student passports and school-private assets are private; school-public assets are public.
- Two teacher signature metadata rows exist and assets are stored in Storage.
- No embedded base64 image payload was found in the 15 current `school_app_state` values.
- The current school branding JSON includes expiring signed URLs as well as stable Storage paths. Stable paths are the durable references; signed URLs must be regenerated when needed.
- The ID-card settings table is empty. The legacy JSON contains an expired validity date (`2026-10-31`) and per-account permissions/pricing. These values were not migrated or reactivated. A school administrator must approve current settings before a new relational ID-card configuration is created.

### 3.6 Browser/device storage and legacy migration

- No active browser persistence write fallback was found in the inspected active `index.html`.
- `localStorage`, IndexedDB and `window.storage` references are in the legacy import/cleanup reader, not the normal current save path.
- The current-device browser stores cannot be inspected remotely through GitHub or SQL. A historical browser snapshot is not proof that every device/browser copy is empty.
- The legacy export utility and source cleanup code remain intentionally available until a fresh authorised browser export and reconciliation confirm that no unique data remains.
- No browser data was deleted.

## 4. Application changes in this phase

1. `loadSchoolData()` now loads `school_portal_settings` for all authenticated roles instead of loading it only for non-administrator roles.
2. `saveAllData()` now writes portal settings to `school_portal_settings` and verifies the returned school ID.
3. `saveAllData()` no longer writes a competing `schoolInfo` JSON snapshot; `schools` remains authoritative for school identity.

## 5. Remaining cutover gates — not falsely marked complete

The following remain necessary before the entire legacy JSON layer can be retired:

1. Convert class arms and Form Master/subject assignment UI consumers to read/write their relational tables exclusively, retaining the legacy activation semantics only where they have a verified relational equivalent.
2. Convert staff database and public staff selection consumers to `school_staff_directory` and `school_portal_staff_selections`; reconcile all 15 staff rows and confirm public field-level privacy.
3. Convert portal news, prefect and duty-roster UI consumers to their dedicated tables. The existing placeholder news item requires school approval before publication.
4. Confirm current ID-card validity, pricing and permission policy with the school administrator, then populate `school_id_card_settings` and `school_id_card_permissions` through the authorised interface.
5. Verify all stamp/signature/logo upload and retrieval flows, including private-bucket access, from an authenticated device.
6. Obtain a fresh read-only browser backup from each device/browser that may contain unique legacy state. Compare before any source cleanup.
7. Perform role-based tests (administrator, Form Master, Subject Teacher, student, public visitor), refresh tests and cross-device tests.
8. Retire the legacy migration reader/export utility only after the above checks and a verified recovery copy.

## 6. Release status

- Live portal settings row inserted and read-back confirmed.
- Frontend portal settings load/save cutover committed.
- No student, staff, class, assignment, result, historical or legacy backup records deleted.
- No Storage bucket made public or removed.
- No legacy browser storage was deleted.
- Full application-wide Supabase-only cutover is **not yet complete**. The remaining UI consumers and unavailable current-device browser copies are explicit blockers, not assumed clean.
