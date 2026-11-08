# E-Result Database Migration — Frontend Storage Inventory

**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Branch inspected:** `main`  
**Inspection date:** 8 November 2026  
**Scope:** Read-only inspection of `index.html` and `supabase-persistence.js`. No application code or database records were changed.

## 1. Executive finding

The application is **partially integrated with Supabase but is not yet fully database-reliant**. The legacy `CloudStorage` layer still reads and writes operational data through `window.storage`, IndexedDB (`EResultDB`) and `localStorage`. The student portal also loads student records from the legacy browser storage path.

Supabase is already used directly for several workflows, including authentication/profile resolution, school profile, classes, subjects, academic sessions, terms, assessment configuration, subject registration, student enrolment and official student records, student import/review workflows, student change requests, Form Master assessments, staff directory records and public staff directory reads.

The presence of these database-backed workflows does not make the entire application database-reliant: the legacy load/save paths remain active for multiple modules.

## 2. Legacy storage implementation

In `index.html`:

- `CloudStorage` detects `window.storage` and opens IndexedDB database `EResultDB`, object store `data` (lines 328–343).
- `save()` writes to `window.storage`, IndexedDB and `localStorage` (lines 374–385).
- `load()` reads in this order: `window.storage`, IndexedDB, then `localStorage` (lines 388–405).
- `globalSave()` and `globalLoad()` repeat this pattern for global keys (lines 408–436).

### Critical save-confirmation defect

`CloudStorage.save()` treats a successful write to **any one** of the three legacy stores as success. It does not confirm a Supabase database write. `saveAllData()` awaits these legacy saves and returns true when they resolve (lines 2167–2205). Therefore, a UI success message following `saveAllData()` cannot be interpreted as proof that the record is stored in Supabase.

This must be corrected as part of the migration: authoritative writes must return success only after the intended Supabase operation succeeds and any required returned row/count has been checked.

## 3. Inventory of literal legacy keys

The following keys were found in calls to `cloudStorage.save/load/globalSave/globalLoad`:

| Key / key family | Current purpose or observed use | Migration direction |
|---|---|---|
| `school:main` | Global school bootstrap/profile data | Reconcile with `schools`; retain only fields not represented by authoritative school profile tables |
| `classArms` | Class/arm configuration and legacy student-name arrays | Map to `classes`; remove embedded student roster as source of truth |
| `formMasters` | Form Master records/configuration | Map to authenticated `profiles` and `form_master_assignments`; inspect any non-identity metadata before mapping |
| `subjectAssignments` | Teacher/subject/class assignment data | Map to `teacher_assignments` and related subject/class/session tables |
| `schoolInfo` | School identity and display fields | Reconcile with `schools`; do not maintain a competing profile copy |
| `managementStaff` | Management role/personnel records | Inspect schema and role model; map to profiles/role assignments or a dedicated table |
| `subAdministrators` | Sub-administrator records | Map to authenticated profiles and role/permission tables; never store credentials here |
| `activityLog` | Recent activity history (last 1,000 entries written) | Consider a dedicated append-only audit/activity table with actor, school, event and timestamp |
| `portalNews` | Public announcements/news | Create or verify a school-scoped portal content table |
| `schoolStaff` | Legacy staff display records | Reconcile with `school_staff_directory`; avoid duplicate staff stores |
| `staffDatabase` | Staff database cache/legacy records | Existing code comments say staff database records are persisted directly to Supabase; remove legacy read/write after verifying all paths use `school_staff_directory` |
| `portalStaffSelections` | Staff portal display selection and visible fields | Store in a dedicated table or a well-defined relational field/table linked to staff directory records |
| `prefects` | Prefect appointments and portal display | Create or verify a school-scoped prefect/appointment table; link to student/enrolment IDs rather than names alone |
| `dutyRoster` | Weekly duty assignments | Create or verify a school-scoped duty roster table; link staff by profile/staff record ID |
| `portalSettings` | Portal enablement, welcome text, term weeks, licensing and other settings | Split school portal settings from developer/licensing controls; use database settings with explicit permissions |
| `students_meta` | Student batch count, total and last-updated metadata | Replace with database queries/counts; do not maintain browser batch counts |
| `students_batch_<n>` | Student register stored in batches of 50 | Official records must come from `students` and `student_enrolments`; preserve existing IDs and reconcile all records before cutover |
| `signature_subjects` | Index of teacher-signature subjects | Store signature metadata in a relational table |
| `sig_<subject>` | Teacher signature content | Store signature files in Supabase Storage and metadata/path in a database table; do not store large base64 images in ordinary row payloads |
| `activationResetV3` | One-time activation reset/migration flag | Replace with a controlled, versioned server-side migration/configuration record if it remains necessary |
| `schoolIdCardSettings` | ID-card pricing and configuration | Determine whether settings are school-owned or platform-wide; store in an appropriately permissioned table |
| `portal:developer` | Developer profile data, including optional photo | Store developer profile in a protected platform-level table; store photo in Storage |
| `keyboardStyle:<user>` | Score-entry UI preference | Optional per-user preference; may remain local cache or move to a user-preferences table |
| `scoreEntryDirection:<user>` | Score-entry UI preference | Optional per-user preference; may remain local cache or move to a user-preferences table |

The key inventory is based on literal calls found in the inspected `index.html`. Dynamic student batch/signature keys are represented by key families above.

## 4. Other browser storage

- `localStorage` is used inside the legacy storage layer and directly for score-entry keyboard style and direction preferences (lines 10031, 10175, 10229 and 10234).
- IndexedDB is opened once by the `CloudStorage` constructor; its object store is used by the legacy save/load methods.
- `window.storage` is used by the same legacy storage layer.
- `sessionStorage` is used by the administrator student-password-reset workflow to retain an operation ID and retry state during the browser session (approximately lines 4540–4650). This is short-lived operation coordination, not the authoritative student record store. Do not remove it without designing an equally safe idempotency/retry mechanism.

## 5. Load and save paths that must be replaced

### Administrator/application load

`loadSchoolData()` loads class arms, Form Masters, subject assignments, school information, management staff, sub-administrators, activity log, portal news, staff, portal selections, prefects, duty roster, portal settings, student batches and teacher signatures through `cloudStorage.load()` (approximately lines 1408–1454).

The school identity is subsequently refreshed from Supabase `schools`, but the other legacy data remains browser-storage sourced.

### Student portal load

`loadStudentPortalData()` loads school information, portal settings, student batches and teacher signatures through `cloudStorage.load()` (approximately lines 1508–1534). This is a critical migration target: student portal results must be derived from authorised database queries for the authenticated student and current enrolment, not from a browser-held copy of the student register.

### Save-all operation

`saveAllData()` writes class arms, Form Masters, subject assignments, school info, management staff, sub-administrators, activity log, portal news, school staff, portal staff selections, prefects, duty roster, portal settings, student batches, student metadata and teacher signatures through `cloudStorage.save()` (approximately lines 2167–2205).

### Public portal load

`showPublicPortal()` sets the storage scope to `MAIN` and loads portal content, staff, prefects, duty roster, portal settings, classes, Form Masters, assignments, management staff, sub-administrators, student metadata and student batches through legacy storage (approximately lines 6800–6835). Public portal data must be read from deliberately public, approved database views/RPCs or narrowly scoped policies. Do not expose student registers or private staff fields to anonymous users.

## 6. Existing Supabase integration observed

The inspected files show direct Supabase use for:

- Authentication and active profile/school resolution.
- School profile reads and updates through `schools`.
- Classes and subjects.
- Academic sessions, terms and assessment configurations.
- Form Master assignments and class subject registrations.
- Student records and enrolments.
- Student import batches and rows, including approval workflows.
- Student change requests and change-request items.
- Form Master student assessments.
- Staff directory reads, inserts and updates through `school_staff_directory`.
- Public staff directory through `get_public_school_staff_directory`.
- Password-reset operations through the `reset-student-password` Edge Function.

The `supabase-persistence.js` helper includes authenticated generic `select/insert/update/upsert/remove` methods, school profile methods, class reads, and read-only integrity audits. The generic methods rely on authentication and database RLS; they are not a substitute for purpose-built, table-specific validation and permission checks.

## 7. Proposed target mapping

| Domain | Existing Supabase objects observed in project history/code | Migration action |
|---|---|---|
| School identity | `schools` | Make authoritative; eliminate duplicate editable browser copy |
| Student identity | `students` | Make authoritative; preserve IDs |
| Student class/session membership | `student_enrolments` | Make authoritative; preserve history and IDs |
| Classes | `classes` | Make authoritative; reconcile legacy class arms |
| Form Master assignment | `form_master_assignments` | Make authoritative |
| Subject/teacher assignment | `subjects`, `teacher_assignments` | Make authoritative |
| Academic calendar | `academic_sessions`, `terms` | Make authoritative |
| Assessment setup | `assessment_configurations` | Make authoritative |
| Results | `results`, `result_comments` and assessment-related tables | Verify all score-entry and result workflows use database-backed records |
| Staff | `school_staff_directory`, `profiles`, `profile_roles` | Reconcile and avoid duplicated staff identities |
| Student imports | `student_import_batches`, `student_import_rows` | Already database-backed; verify every submission path |
| Student change workflow | `student_change_requests`, `student_change_request_items`, `student_change_request_history` | Already database-backed; verify all actions and audit events |
| Portal content | Not established by this inspection | Design dedicated school-scoped tables and public read surfaces |
| Prefects and duty roster | Not established by this inspection | Design relational tables with staff/student references |
| Teacher signatures and ID-card assets | Not established by this inspection | Use Supabase Storage plus metadata tables |
| Activity/audit history | Existing change history tables; general activity table not established | Separate security audit history from ordinary UI activity |
| User preferences | Not established by this inspection | Keep non-critical preferences local or create a per-user preferences table |

**Important:** “Not established by this inspection” means the inspected frontend/helper did not establish a corresponding table. It is not a claim that no such table exists in the live database. Verify the live schema before creating anything.

## 8. Migration order and safety gates

1. **Schema and workflow verification (read-only):** inspect all relevant tables, columns, foreign keys, unique constraints, RLS policies, Storage buckets and Edge Functions. Confirm the live schema and migrations before proposing DDL.
2. **Staging and recovery:** establish an isolated staging Supabase project and verified backups/restore procedure. The preview and live application currently share the same Supabase project, so preview writes are production writes.
3. **Data mapping and reconciliation:** identify the authoritative source for every field. Compare legacy browser data with existing database rows using stable IDs and approved matching rules. Do not import stale cache over newer database records.
4. **Build database structures:** add only missing, justified tables/columns/indexes/policies after schema verification. No blanket grants or broad RLS policies.
5. **Migrate one domain at a time:** begin with a low-risk module, test create/read/update/delete and cross-device behaviour, then proceed to the next module.
6. **Dual-read validation only where safe:** do not permit uncontrolled dual writes. Log reconciliation differences and define one authoritative source per domain.
7. **Cut over reads and writes:** Supabase must be the source of truth. UI success is shown only after database confirmation.
8. **Retire legacy storage:** only after verified reconciliation, production acceptance, rollback planning and confirmation that no active code path depends on the legacy key.
9. **Document and train:** publish a manual section for each completed migration phase.

## 9. Immediate blockers and risks

- The current `saveAllData()` path can report success when only local browser storage succeeded.
- The student portal still reads student data from legacy browser storage.
- Public portal code loads multiple private-looking datasets from the global `MAIN` browser-storage namespace. This must not be reproduced as unrestricted anonymous database access.
- The browser's `schoolId` scope is a legacy key prefix, not a security boundary. Supabase RLS and server-side school scoping must enforce tenant isolation.
- Staff directory is partially database-backed, but legacy `schoolStaff` and `staffDatabase` values are still loaded into application state; verify all remaining consumers before retiring them.
- Teacher signatures and profile photos should use Storage for files, with database metadata and access rules.
- The password-reset workflow's sessionStorage idempotency state is a distinct security concern and should not be casually removed.
- Do not delete or overwrite existing student, enrolment, result, staff or academic records during migration.
- The class-list approval function currently deletes matching enrolments for an approved clear request. Redesign and validate this destructive workflow before enabling it.

## 10. Acceptance criteria for complete database reliance

- Every operational record has one defined authoritative database table or Storage object.
- Every create, read, update and delete path is authenticated and constrained by RLS or a properly authorised server-side function.
- School-scoped records cannot be read or changed across schools.
- Student portal data is retrieved using the authenticated student's identity and current enrolment.
- Public portal reads expose only explicitly approved public fields.
- No core record depends on `localStorage`, IndexedDB or `window.storage` for persistence.
- A user can sign in on another authorised device and see the same current records.
- A save is reported successful only after the database confirms it.
- Data counts, relationships, historical records and file references are reconciled after each migration.
- Backups, restore tests, rollback instructions and module-specific training documentation are complete.

---

**Inspection source files**

- `index.html` blob inspected: `37a1032fa3533161425d10c613f324329bf298c3`
- `supabase-persistence.js` blob inspected: `c070ed6f58c930bd867def361a5b8fb3ad0fc353`

**Status:** Inventory prepared from repository source. No application source code, Supabase schema, production data or user records were modified by this inspection.
