# Phase 6 — Live Supabase Baseline and Legacy Storage Cutover Readiness

**Project:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Branch:** `main`  
**Review date:** 8 November 2026  
**Mode:** Read-only live baseline and source/backup inspection  
**Production data writes:** None  
**Destructive changes:** None

## 1. Purpose

This phase continues the Supabase-only persistence programme by checking the live Supabase project against the existing application source and the previously supplied browser-storage snapshot. The objective is to migrate all durable school application data from browser/device or other non-Supabase storage into Supabase Database or Supabase Storage, while preserving authoritative records and preventing duplicate or stale imports.

This phase does not claim that all migration work is complete. It establishes the current verified baseline, identifies safe migration decisions and records the remaining blockers before any write migration.

## 2. Confirmed project and live Supabase baseline

The connected active Supabase project is:

- Project name: `DE-GLOBAL-E-RESULT`
- Project reference: `rvmcqvfuioxmbtvgdptb`
- Project status at review: `ACTIVE_HEALTHY`
- School: DE-GLOBAL ACADEMY GBOKO
- School UUID: `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`

Read-only live counts returned on 8 November 2026:

| Supabase object | Current count |
|---|---:|
| School row | 1 |
| Classes | 30 |
| Assessment configurations | 6 |
| Form Master assignments | 16 |
| Subject teacher assignments | 1 |
| Students | 743 |
| Student enrolments | 743 |
| School staff directory | 15 |
| Results | 0 |
| Objects in `school-private-assets` | 10 |
| Objects in `school-public-assets` | 1 |
| Objects in `student-passports` | 8 |

The three existing Storage buckets are retained. No bucket was created, renamed, made public, or deleted during this phase.

## 3. Source-code persistence audit

The current `index.html` still contains the legacy `CloudStorage` implementation and references to:

- `window.storage`
- IndexedDB database `EResultDB`
- `localStorage`
- `sessionStorage`

The source still has active legacy load/save paths, including the school administrator load, student portal load, public portal load and `saveAllData()` workflows. The direct localStorage references also include score-entry keyboard and direction preferences.

The separate `supabase-persistence.js` helper does not itself use localStorage, sessionStorage, IndexedDB or `window.storage`; however, its existence does not replace the remaining legacy paths in `index.html`.

### Critical defect still requiring application cutover

The legacy save layer may report success when a browser-side store succeeds. That is not proof of a Supabase write. The application must not report a durable save until the intended Supabase database or Storage operation succeeds and returns a verified result.

The student portal and public portal must also stop using browser-held student/register data. Student views must be scoped to the authenticated student's authorised records. Public reads must expose only deliberately approved public fields.

## 4. Existing browser snapshot inspected

A previously supplied backup is available in the Library:

`DE-GLOBAL-LEGACY-BROWSER-BACKUP-2026-11-07T07-37-47-403Z.json`

Snapshot timestamp: 7 November 2026, 07:37:47 UTC.

| Snapshot check | Result |
|---|---:|
| localStorage keys exported | 43 |
| IndexedDB records exported | 16 |
| IndexedDB records matching localStorage values | 16 of 16 |
| Authentication token keys excluded | 2 |
| `window.storage` available at snapshot time | No |
| `window.storage` records exported | 0 |
| Student batches/records present in captured snapshot | None |
| Database writes performed from snapshot | 0 |

The 16 IndexedDB entries are exact duplicates of corresponding localStorage values and must not be counted or imported twice. The snapshot is not a complete browser/device backup: it does not include Chrome cookies or Supabase Auth tokens, and the `window.storage` source was unavailable. It is also dated 7 November and must not be assumed to represent changes made after that time.

## 5. Migration decisions from the captured snapshot

| Category | Evidence and live destination | Decision |
|---|---|---|
| School identity | Existing `schools` row; earlier secure profile workflow documented | Keep Supabase authoritative. Do not overwrite with stale browser copies. |
| Classes/class arms | 30 captured names; earlier Phase 3B reconciliation confirmed exactly one matching Supabase class for each name | No import required. Use existing class UUIDs and replace legacy reads with Supabase reads. Do not copy embedded student slots or legacy class passwords. |
| Assessment configuration | Six active Supabase configurations; earlier reconciliation confirmed the 10/10/10/70 maxima for 2026/2027 First Term | No import required. Keep Supabase configuration authoritative. |
| Form Master assignments | 16 existing Supabase assignment rows; snapshot collection is empty | No import required from this snapshot. Use existing secure assignment workflow. |
| Subject teacher assignment | One legacy assignment has a blank teacher ID; one existing Supabase assignment exists and is inactive | Do not insert a duplicate or activate it automatically. Preserve current database state pending the normal administrator assignment workflow. |
| Students and enrolments | Snapshot contains no student batch payload; live Supabase has 743 students and 743 enrolments | No student import from this snapshot. Keep existing student and enrolment records authoritative. |
| Staff | Four school-prefixed legacy staff entries and a separate global legacy staff entry; 15 existing Supabase staff directory rows | Reconcile by stable profile/record identifiers before any write. Do not bulk import or duplicate existing staff. |
| Activity log | Seven captured school activity entries; no confirmed dedicated destination table was established in the inspected migration map | Preserve the source backup. Define an append-only audit destination and retention/access rules before import. |
| Portal news | One captured announcement with placeholder-looking text | Hold for administrator content verification; do not publish automatically. |
| Portal settings | Captured settings mix presentation preferences with licensing/sales metadata | Split school-owned settings from privileged platform/licensing controls. Do not trust browser values as licence authority. |
| ID-card settings | Captured configuration has validity date 31 October 2026, already expired at snapshot time | Do not migrate expired permissions/pricing as active policy. Obtain current administrator-approved values first. |
| Teacher signature and school stamp | Image data URLs are embedded in the snapshot | Migrate actual binary assets to an appropriately private Supabase Storage bucket and store only object paths/metadata in Database. This requires a validated upload path and access policy; no asset upload was performed in this phase. |
| UI preferences | Keyboard style and score-entry direction preferences | If they must persist across devices, create a narrowly scoped per-user preferences table with RLS. Otherwise keep them only in ephemeral UI state. Do not retain localStorage persistence. |
| Developer profile and unrelated application keys | Browser-global developer details and unrelated theme/workspace keys | Exclude from school data migration. Developer privileges and licensing must be server-authoritative. |
| Auth/session tokens | Excluded by backup exporter | Do not migrate tokens as business data. Continue using the supported Supabase Auth session mechanism; never copy tokens into ordinary application tables. |

## 6. Existing Supabase Storage review

The live project already has three buckets:

- `school-private-assets` — private
- `school-public-assets` — public
- `student-passports` — private

Live object counts are recorded in Section 2. Storage policies exist for passport access, private school assets, public school assets and teacher signatures. This is an inventory finding only; the presence of policies does not prove every policy has been fully penetration-tested or that each asset is correctly classified.

Do not make private assets public to simplify previews. Keep student passports and signatures under least-privilege access. Do not insert rows directly into Supabase's internal `storage.objects` table; upload through the supported Storage API/client or a properly authenticated server-side upload function.

## 7. What can be migrated without copying data

The following categories already have matching authoritative Supabase records and should be cut over in application code rather than re-imported:

1. School identity.
2. Class identity and class names.
3. Assessment configuration.
4. Form Master assignments.
5. Student and enrolment records.
6. Existing staff directory records.

For these categories, migration means replacing legacy browser reads/writes with verified Supabase reads/writes while preserving existing UUIDs, constraints, RLS and secure workflows.

## 8. Remaining migration workstreams

1. **Application cutover:** replace legacy `CloudStorage` reads/writes with domain-specific Supabase persistence methods. Audit every caller, not just `saveAllData()`.
2. **Portal content:** design and secure school-scoped tables for approved news, prefect appointments and duty rosters only if these features remain required.
3. **Portal settings:** create a properly scoped settings model and keep privileged licensing/developer state outside school-controlled browser data.
4. **Audit/activity history:** choose a verified append-only audit destination; preserve actor, timestamp, event and entity context.
5. **File assets:** upload signatures, stamps, logos and other approved files to the correct existing Storage bucket. Store object paths and safe metadata in relational tables.
6. **User preferences:** decide whether cross-device persistence is required; if yes, use a user-scoped table and RLS.
7. **Retirement:** remove legacy storage code category by category only after read-back, role, refresh, cross-device, backup and rollback checks pass.

## 9. Required source data and access limitations

The developer can inspect repository code, the supplied Library snapshot and the connected Supabase project. The developer cannot read a user's current browser localStorage/IndexedDB directly through GitHub or SQL. A browser snapshot can only contain what the exporter actually read at the time it ran.

Before any import from a live browser/device, obtain a fresh read-only export from that original browser and preserve it unchanged. If a legacy provider contains data not present in the snapshot, export that provider's records using its own authorised export mechanism. Never ask the user to share passwords, Supabase service-role keys, database passwords or Auth tokens.

No external provider or local device is to be declared empty merely because its records are absent from this one snapshot.

## 10. Release and migration safety gates

- Do not overwrite non-empty Supabase data with stale or blank browser values.
- Do not bulk import students, enrolments, results, staff or permissions without exact identity matching and conflict review.
- Do not create generic JSON key/value storage as a substitute for domain tables.
- Do not weaken RLS or expose service-role credentials.
- Do not make private Storage buckets public.
- Do not delete source browser data, local files or external-provider records until the Supabase copy is verified and a rollback/backup is confirmed.
- Do not mark a category migrated until counts, relationships, file existence, access policies and reload behaviour are tested.
- Use staging or controlled test records for write testing; the preview and live application currently share the production Supabase project.

## 11. Phase 6 outcome

**Completed:** Connected Supabase project confirmed; live row and Storage object baseline queried; current frontend legacy persistence paths confirmed; supplied browser snapshot inspected; duplicate IndexedDB/localStorage values identified; migration decisions and stop conditions recorded.

**Not completed:** No legacy records or files were written to Supabase in this phase. No application source code was cut over. This was intentional because the captured snapshot is incomplete/stale for current-device state, several records need identity/content approval, and binary Storage migration requires a verified upload workflow. No data was deleted or altered.

**Next implementation gate:** Build and test a controlled migration intake and category-specific Supabase cutover workflow, starting with the already reconciled classes and assessment configuration reads. Preserve the original browser backup and retain the current legacy data until each category passes acceptance testing.


## 12. Supabase security advisor findings (8 November 2026)

A live Supabase security-advisor check returned the following findings:

- Four tables have RLS enabled but no policies: `form_master_password_reset_operations`, `permissions`, `result_comments` and `student_password_reset_operations`. Confirm whether each is intentionally accessed only through trusted server-side functions. Do not add broad client policies simply to clear the warning.
- The advisor reported 17 `SECURITY DEFINER` functions executable by `anon` and 23 executable by `authenticated`. This includes sensitive student change, class-list, enrolment, role/permission and assessment-related functions. Review each function's body, explicit identity/role checks, search_path, grants and intended caller before changing privileges. Do not mass-revoke or switch functions to `SECURITY INVOKER` without dependency testing.
- Supabase Auth leaked-password protection is disabled. Enablement should be reviewed with the administrator because it changes password acceptance behaviour for users.

These are security review findings, not proof that all listed functions are exploitable. They are a required security gate before widening any new migration write paths or creating new public read surfaces.

Remediation references:
- [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Public can execute SECURITY DEFINER function](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Signed-in users can execute SECURITY DEFINER function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)


## 13. Fresh browser snapshot — 8 November 2026, 21:00:50 UTC

A new read-only browser backup was received and inspected:

`DE-GLOBAL-LEGACY-BROWSER-BACKUP-2026-11-08T21-00-50-311Z.json`

- Origin: the deployed DE-GLOBAL Academy E-Result application on `samdiok.github.io`.
- 43 localStorage keys were exported.
- IndexedDB `EResultDB` was available and contained 16 records.
- All 16 IndexedDB records exactly matched localStorage entries; there are no additional IndexedDB-only records in this snapshot.
- `window.storage` was unavailable and returned no records.
- Two Supabase Auth token keys were intentionally omitted by the exporter. Do not migrate or request these tokens.
- The backup remains a browser snapshot, not a Supabase database backup and not a Chrome-cookie export.

### 13.1 Fresh snapshot inventory

| Record group | Snapshot finding | Migration decision |
|---|---|---|
| Class arms | 30 class names from BASIC7A to SS3E; all student-name and sex slots empty; all legacy activation flags false | No student/class roster import. The live database already has 30 classes. Use the existing Supabase class IDs. |
| Legacy class passwords | A password field is present on all 30 legacy class objects | Treat these as exposed legacy credentials. Never import or reuse them. Retire the browser password path and use the existing authenticated Form Master/role workflow. |
| Assessment configuration | 30 class keys, all carrying CA1 10, CA2 10, CA3 10 and examination 70 | Do not bulk import. Reconcile against the six live Supabase assessment configuration rows and keep database configuration authoritative. |
| Student metadata | Both MAIN and school-scoped metadata report zero batches and zero students | No student data is available in this browser snapshot. Live Supabase student/enrolment records remain authoritative. |
| School-scoped subject assignment | One BASIC7A Mathematics record, marked active in browser data, but its legacy teacher ID is blank | A matching live Supabase class/subject assignment row exists, has a linked teacher UUID and is inactive. Do not import or activate it. Resolve the identity and activation discrepancy through the authorised administrator workflow. |
| School information | School profile includes school stamp and stamp-signature data URLs | Extract and validate these binary assets; upload to private `school-private-assets` only through a verified authenticated Storage workflow. Keep object paths, not base64 blobs, in Database. |
| Subject-teacher signature | One English Studies signature data URL | Candidate for private Storage migration after asset validation and authorised ownership check. |
| Developer profile photo | One developer profile photo data URL | Exclude from school records. Do not copy developer identity/profile data into school tables or school asset buckets. |
| Staff database | Four school-scoped legacy staff entries and one separate MAIN administrator entry | Do not bulk import. Reconcile stable identities against the 15 existing Supabase staff directory records; preserve school-scoped permissions and profile links. |
| Activity history | Seven school-scoped activity records | Preserve the source backup. Import only after a dedicated append-only audit destination and duplicate/idempotency key have been approved. |
| Portal announcement | One announcement with placeholder-looking title and message | Do not publish or import automatically. Require content-owner approval. |
| Portal settings | Portal welcome, term weeks and enabled flags are mixed with license-expiry and sales fields | Split school-controlled settings from privileged licensing/sales metadata. Only approved school settings may be migrated. |
| ID-card settings | Validity date recorded as 31 October 2026, already expired at snapshot time | Do not reactivate or migrate as current policy. Require a fresh administrator-approved validity and fee policy. |
| UI/theme/workspace keys | Theme preferences and unrelated CodeForge/SDP-BESR menu/workspace state are also present in the same browser origin | Exclude from school E-Result domain data. If a cross-device preference is required, store it in a separate user-scoped preferences table. |

### 13.2 Asset inventory from the fresh snapshot

The snapshot contains four image data URLs:

| Asset | Approximate encoded size | Handling |
|---|---:|---|
| Developer profile photo | 434 KB | Exclude from school migration |
| School stamp | 344 KB | Candidate for private Storage |
| Stamp signature | 160 KB | Candidate for private Storage |
| English Studies teacher signature | 252 KB | Candidate for private Storage |

These are base64-encoded image data embedded in browser values. No binary assets were uploaded during this audit. Before upload, validate image decoding, MIME type, dimensions, file size, object naming, ownership and bucket access. Do not store base64 image strings in relational columns.

### 13.3 Cross-check against live Supabase

The live project was queried again for the assignment represented in the fresh snapshot. A single matching class/subject assignment exists in `public.teacher_assignments`, but the live row is inactive and linked to a teacher UUID, whereas the browser copy has a blank teacher ID and says active. This is a conflict, not a safe import candidate. The database record must not be overwritten from the browser snapshot.

The live baseline previously recorded in Section 2 remains unchanged by this inspection. No database row, Storage object, bucket, policy or application file was changed by processing this backup.

### 13.4 Updated cutover decision

The new snapshot confirms that the browser still contains legacy persistence data, but most captured school data is either empty, already represented in Supabase, or requires identity/authority review. The next safe work is therefore **application cutover plus controlled asset migration**, not a blind bulk import.

Priority order:

1. Replace the legacy class/assessment/subject-assignment reads with verified Supabase-backed reads and preserve the live assignment's inactive state until authorised.
2. Replace the legacy school-info, staff, portal and settings persistence with domain-specific, school-scoped Supabase operations.
3. Build an authenticated, idempotent image upload flow for the school stamp, stamp signature and teacher signature into the existing private bucket.
4. Define and secure the append-only activity/audit destination before migrating seven history entries.
5. Remove legacy class passwords and all browser-held authentication/permission assumptions.
6. Run role, RLS, cross-device and refresh tests before disabling any legacy read path.

**Phase 6 status remains:** audit and migration decisions documented; no bulk data import or asset upload has been performed. The source backup must remain preserved until each destination is verified.


## 14. Supabase audit destination and first live cutover controls — 8 November 2026

### 14.1 Append-only activity audit destination

Created `public.school_activity_audit` in the live DE-GLOBAL-E-RESULT project. This is a domain-specific destination for school activity events, not a generic browser key/value store.

The table records:
- school scope and authenticated actor profile;
- an idempotency/source event identifier, unique within a school;
- action label and optional affected-record UUID;
- event timestamp and bounded JSON object details.

Security controls verified after creation:
- RLS is enabled;
- two policies exist: active school users may insert only as themselves within their own school; active school administrators may read their school's audit rows;
- authenticated users have no UPDATE, DELETE or TRUNCATE table grants;
- `anon` has no table grants;
- the unique `(school_id, source_event_id)` constraint supports idempotent retries.

Seven historical browser activity events were imported from the 8 November browser backup after matching the recorded actor label to one active administrator profile in the same school. Deterministic source IDs were derived from the school, actor label, event timestamp, action and affected-record text; the insert used the unique constraint with conflict-safe handling. The two closely timed Geography assignment events were preserved as separate events because their timestamps differ. No source browser records were deleted.

### 14.2 Application write path

Added `appendActivityAudit` and `getActivityAudit` to `supabase-persistence.js`. The append method checks the authenticated user and active school profile, validates event fields, and treats a repeated source event ID as an idempotent retry.

Updated `logActivity` in `index.html` to append newly generated events to Supabase. The in-memory activity array is used for the current screen only; `saveAllData` no longer writes the activity log to browser storage. Administrator history is loaded from Supabase. Personal names are not copied into new audit records; an affected-record value is retained only when it is a UUID. A failed Supabase audit write is logged and shown as a warning rather than silently reported as successful.

This activity-log category has now been cut over: the seven legacy events are stored in Supabase, administrator history reads come from Supabase, and new events are written to Supabase. The old browser activityLog key is no longer read or written by the updated application. The old browser copy remains in the browser as a rollback artefact and has not been deleted.

### 14.3 Related live-code correction

The Subject Teacher login query now requires `teacher_assignments.is_active = true`. This prevents an inactive Supabase assignment from being treated as a current assignment merely because a stale browser copy labels it active. The matching live assignment found during the audit remains inactive; it was not activated or altered.

### 14.4 Verification and outstanding work

- Live SQL verification confirmed RLS enabled, two policies present and zero authenticated UPDATE/DELETE/TRUNCATE grants on `school_activity_audit`.
- Supabase Security Advisor was rerun. The new audit table did not add an RLS-without-policy finding. The pre-existing findings remain: four other RLS-enabled tables without policies, 17 SECURITY DEFINER functions callable by `anon`, 23 callable by `authenticated`, and leaked-password protection disabled. These remain separate security-review items; no blanket revocations or policy changes were made.
- SQL verification confirmed seven rows and seven unique source event IDs, spanning 2 October to 6 November 2026. The application append path still requires a live authenticated browser-session acceptance test; the SQL historical import does not prove that browser RLS writes work end to end.
- Browser localStorage, IndexedDB and legacy `window.storage` fallbacks have not been removed. The seven activity events are the only historical browser activity records imported in this stage. No legacy staff rows, portal content, class records, student data or branding assets were bulk-imported or deleted.
- Next cutover work remains: migrate the class and assignment management screens to authoritative Supabase reads/writes; move school portal content/settings into school-scoped domain tables; import validated branding assets to private Storage; then verify cross-device persistence, RLS, idempotency, refresh behaviour and rollback before retiring browser persistence.


## 15. Subject Teacher assignment management moved to Supabase — 8 November 2026

### 15.1 Authoritative assignment list

The administrator's Subject Teacher management screen now loads assignment rows from `public.teacher_assignments` for the authenticated school and active academic session. Class names, subject names and teacher details are resolved from the corresponding Supabase `classes`, `subjects` and `profiles` records.

The screen no longer renders its Subject Teacher list from the browser's `subjectAssignments` snapshot. The new assignment form also loads class, subject and active staff options from Supabase. After the existing `create-subject-teacher` Edge Function confirms a new assignment, the screen reloads the database list; it does not push a synthetic assignment into browser storage or call `saveAllData()` for that assignment.

Assignment status is displayed from the database `is_active` field. Account status is displayed separately from `profiles.is_active`.

### 15.2 Secure activation and removal

Created and deployed `manage-subject-teacher` (Edge Function version 1, JWT verification enabled). Its only supported operations are:
- `set_active`: update the selected assignment's `is_active` value;
- `remove_assignment`: remove one assignment row.

The function obtains the caller from the verified JWT, then independently verifies that the caller's profile is an active School Administrator. It derives the school scope from that profile and refuses assignment IDs outside that school. The client cannot nominate another school or another actor.

The existing `teacher_assignments` table has a school-scoped SELECT policy but no direct authenticated UPDATE or DELETE policy. The administrator-only Edge Function is therefore the controlled mutation route; no broad direct table mutation grants or RLS policies were added.

Removing an assignment deliberately leaves the teacher's Auth account, `profiles` row, `profile_roles`, other assignments and results untouched. Bulk-clear assignment controls were removed from the interface and bulk deletion is disabled.

### 15.3 Score-entry enforcement

Subject Teacher score-sheet loading and the final pre-save assignment check both now require `teacher_assignments.is_active = true`. This closes the gap where a teacher with an already-open session might continue to access or save scores after an administrator deactivates the assignment.

### 15.4 Live verification and remaining acceptance test

- Confirmed that `manage-subject-teacher` is deployed and ACTIVE with JWT verification enabled.
- Confirmed the latest frontend source fetch contains the Supabase assignment query, database-derived activation status, Edge Function actions, no local assignment push, and no bulk-clear button.
- Confirmed both score-entry assignment checks require `is_active = true`.
- The live database currently has one teacher assignment in the active academic session: one inactive and zero active. The existing BASIC7A Mathematics assignment remains inactive. This maintenance pass did not activate, remove or otherwise modify that row.
- The administrator browser acceptance test remains outstanding: activate an assignment, verify the database status and teacher login, deactivate it and verify that the teacher cannot open or save the score sheet, then remove a test assignment only if the administrator explicitly chooses one. No live assignment was changed as a test in this pass.
- The Form Master management panel already reads and mutates its assignments through the existing `manage-form-master` Edge Function and Supabase classes table. The Form Master login dropdown now displays a placeholder before sign-in, then retrieves assigned classes from Supabase after authentication; when multiple classes exist, it prompts the user to select one and sign in again. The wider legacy class-arm cache is still used by older result-entry paths and remains scheduled for a separate migration stage; it has not been deleted or bulk-replaced here.


## 16. Class and student-roster migration dependency audit — 8 November 2026

### 16.1 Live authoritative class and enrolment baseline

The live database was queried for the school's current academic session and class roster. The current session is **2026/2027** (`a75e1716-180c-495a-b986-32ad282500ee`). It contains **743 non-archived enrolments across 16 class arms**. The school has 30 class rows in total, covering BASIC 7–9 and SS 1–3, arms A–E. The other 14 class arms currently have no active enrolments. No class or enrolment rows were inserted, updated or deleted during this audit.

The current enrolment distribution by class is:
- BASIC7A 44; BASIC7B 43; BASIC7C 30.
- BASIC8B 58; BASIC8C 50.
- BASIC9A 68; BASIC9B 61; BASIC9C 29.
- SS1B 80; SS1C 7.
- SS2A 63; SS2B 80; SS2C 18.
- SS3A 38; SS3B 60; SS3C 14.
- The remaining class arms have zero non-archived enrolments.

The legacy browser backup's 30 class-arm objects had empty student-name and gender slots. Their embedded password fields are exposed legacy credentials and must not be imported or reused. The class definitions already exist in Supabase, so no class-arm bulk import is required.

### 16.2 Cutover dependency discovered in the frontend

The current `loadSchoolData()` still reads `classArms`, `formMasters` and `subjectAssignments` from `cloudStorage`. `saveAllData()` still writes all three categories back to browser storage. The older class-arm screen also offers a legacy student-name editor and keeps class assignment display state in the `classArms` array.

More importantly, the older `saveStudent()` workflow constructs a complete result record in the browser-side `students` array and persists it by calling `saveAllData()`. The same `students` array is consumed by result views and parts of the portal. Consequently, replacing the class roster loader or removing the student batch keys before migrating this result workflow would create a split source of truth and could break result entry, result retrieval or publication.

### 16.3 Existing Supabase roster path

The frontend already contains `loadStudentDatabase()` and `loadOfficialStudents(classId)`, which retrieve classes and official enrolments from Supabase for the authenticated school and active session. Form Master assessment also has a dedicated `loadFormMasterOfficialEnrolments()` path that verifies the Form Master assignment and reads non-archived enrolments ordered by register number. These are useful foundations, but they do not by themselves replace the legacy result-record lifecycle.

### 16.4 Safe migration order and current decision

The next implementation stage must first map and migrate the complete result-record lifecycle (score entry, per-term/session retrieval, publication/release stages, student portal, attendance/fees/Form Master comments, signatures/passports and report generation) to the appropriate school-scoped Supabase tables and Storage paths. The result schema and write permissions must be inspected before changing the write path.

After that dependency is proven with authenticated role tests, the class-arm screen can be made a database-backed view of `classes` and `form_master_assignments`, and the roster can be read from `students` plus `student_enrolments`. Only then should `classArms`, `formMasters`, `subjectAssignments` and `students_batch_*` browser persistence be retired. The legacy browser data remains untouched as a rollback artefact.

### 16.5 Verification boundary

This was a read-only audit. No student, enrolment, class, result, assignment or browser record was changed or deleted. The 743 live enrolments and 30 class definitions remain authoritative. No cutover is claimed for the class roster or student results in this section.


## 17. Existing Supabase results schema and access-policy audit — 8 November 2026

### 17.1 Existing result destinations

The live schema already contains `results`, `form_master_student_assessments` and `result_comments`. The `results` table is a subject-level score record with school, student, class, subject, academic session and term identifiers; CA1, CA2, CA3, examination, total, grade and remark fields; entering profile; workflow status; and submitted, approved and published timestamps.

The `form_master_student_assessments` table separately stores affective and psychomotor JSON ratings, Form Master comment, attendance days, school days, next-term fees and the assessing profile, scoped to a student, class, session and term. This is aligned with the newer Form Master assessment interface already in the frontend.

### 17.2 Current live data state

Read-only count checks returned zero rows in all three tables for this school: `results` 0, `form_master_student_assessments` 0 and `result_comments` 0. No legacy browser result record has been imported and no result record was created or modified during this audit.

### 17.3 RLS policy observations

RLS is enabled on all three tables. The `results` table has policies for subject teachers to insert, view, update and submit their own assigned draft results; administrators to view, approve and publish; Form Masters and sub-administrators to view scoped results; and students to view only their own published results. Authenticated deletion is explicitly denied by a false DELETE policy. These policy expressions must be tested with real role sessions before relying on them for the cutover.

`form_master_student_assessments` has assigned-Form-Master SELECT, INSERT and UPDATE policies that check the assignment and active enrolment. `result_comments` currently has no policies in the policy catalogue; it remains inaccessible through ordinary authenticated RLS until an intentional authorisation design is approved. Do not add a broad policy merely to make the table writable.

### 17.4 Next implementation boundary

The next implementation should map each legacy result object's subject scores to `results` rows and its Form Master-only fields to `form_master_student_assessments`, using official student, class, session and term UUIDs. It must also establish how existing administrator and sub-administrator score entry should interact with the current subject-teacher draft/submission and administrator approval workflow. Student-facing retrieval must use the published `results` rows and the official student profile link, not a browser-held copy.

Before writing code, inspect the remaining result UI and the current Supabase persistence/Edge Function implementations, reconcile score limits and term IDs, then implement one role path at a time. Validate duplicate prevention, assignment revocation, draft submission, administrator approval/publication, student visibility and refresh/cross-device retrieval. Keep the legacy browser records as rollback copies until all these tests pass.

### 17.5 Verification boundary

This was a read-only schema, policy and row-count audit. No RLS policies, grants, table definitions or records were changed. The browser result store has not been retired.


## 18. Subject Teacher result access tightened to active assignments — 9 November 2026

### 18.1 Issue identified

The frontend already checked `teacher_assignments.is_active = true` when loading a Subject Teacher score sheet and immediately before saving. The database `results` RLS policies did not consistently enforce that same condition. In particular, the previous INSERT, UPDATE and SELECT policy expressions could authorise a teacher based on an assignment row even after it had been deactivated. A second legacy UPDATE policy named `Subject teachers can submit draft results` also remained in place; PostgreSQL combines permissive policies with OR semantics, so leaving that older policy would have bypassed a newly tightened policy.

### 18.2 Live policy correction

Applied a Supabase migration named `enforce_active_subject_teacher_assignments_for_results` to require `teacher_assignments.is_active = true` in the Subject Teacher INSERT, draft UPDATE, draft-to-submitted UPDATE and SELECT policies on `public.results`. The conditions also continue to require the authenticated active profile, correct Subject Teacher role, same school, teacher, class, subject and academic session, and the permitted result status/author.

Removed the obsolete permissive policy `Subject teachers can submit draft results` with a separate migration named `remove_legacy_unrestricted_subject_result_submission_policy`. This removal was necessary because an older permissive policy would otherwise continue granting access despite the stricter replacement.

### 18.3 Verification and limitations

A fresh `pg_policies` query confirmed the remaining Subject Teacher result policies are the intended four policies (INSERT, SELECT, draft UPDATE and submit UPDATE), and every assignment predicate includes `ta.is_active = true`. The old permissive submission policy no longer appears. No result rows were present to alter, and no teacher assignment was activated or deactivated as part of this change.

The current active academic session still has one inactive Subject Teacher assignment and zero active assignments. Consequently, an end-to-end authenticated Subject Teacher save test cannot yet be performed without an authorised administrator activating a legitimate assignment. The policy correction is verified structurally, not by a live role-session transaction.

### 18.4 Result persistence remains in progress

The newer Subject Teacher score sheet already reads official enrolments and existing results from Supabase and upserts score rows into `public.results`. Its upsert conflict target matches the existing unique key `(student_id, subject_id, academic_session_id, term_id)`. The legacy administrator/sub-administrator `saveStudent()` path still builds aggregate student result objects and calls `saveAllData()`, which writes the `students_batch_*` browser keys. That legacy path has not been cut over. Administrator/sub-administrator write permissions, grade-scale consistency, result release semantics, report-card assembly, student portal reads and private media references must be reconciled before moving that path.

No student data, results, class rows, enrolments, or browser backups were changed or deleted during this policy correction. Browser result storage remains intact.


## 19. Result release and administrator-entry dependency audit — 9 November 2026

### 19.1 Legacy release workflow is a separate data concern

The existing administrator Release Results screen still reads and changes `students` objects in memory. It stores `releaseStage` (0–4), `published`, and a student password on those legacy aggregate objects. Release stages are progressive: first CA, second CA, third CA, and final. The student results screen uses that stage to decide which score columns and related statistics to show. Bulk release advances matching browser objects and calls `saveAllData()`.

The current Supabase `results.status` workflow is different: subject-teacher records are draft, then submitted, then administrator-approved and published. A single `published` status cannot by itself express the legacy per-student progressive stage. The migration must preserve both the approval workflow and the intended staged visibility, without storing student passwords in result rows or browser data.

### 19.2 Administrator and sub-administrator entry path

The legacy administrator/sub-administrator `saveStudent()` creates one aggregate student result object containing demographic copies, all selected subject scores, Form Master information, attendance, fees, learner ratings, passport/signature data, and release metadata. It then calls `saveAllData()`. The appropriate database mapping is not a direct one-table replacement: official identity/enrolment remains in `students` and `student_enrolments`; each subject score maps to a `results` row; and Form Master-only assessment values map to `form_master_student_assessments`. Images must be stored as private Storage objects with authorised references, not base64 in result JSON.

### 19.3 Permission model dependency

The frontend's sub-administrator `publishResults`, `enterResults` and `editResults` checks currently use `currentUser.permissions`, which is loaded by the legacy account workflow. The live database has `profiles`, `profile_roles`, `permissions` and `role_permissions`, but there is no dedicated sub-administrator account table among the public tables inspected. The `permissions` table was previously identified by the security audit as RLS-enabled without policies. Therefore, no database write or release policy should trust a browser-provided permission object. Before enabling sub-administrator result writes or publication, establish the authoritative permission assignment and verify it server-side (preferably in a JWT-verified Edge Function or a narrowly scoped database function).

### 19.4 Student-facing identity and release design

The current student portal's result lookup still loads legacy `students_batch_*` objects and filters by admission number. The new authenticated student model links a `students.profile_id` to an Auth profile, and the existing `results` RLS policy permits a student to view only their own rows whose status is `published`. The new portal must use the authenticated student profile link, not admission-number-only filtering or a browser-stored password.

A separate school-, student-, session- and term-scoped release-stage record (or equivalent carefully constrained design) is required to represent the legacy progressive release stages. Its policy must allow only authorised school administrators and verified server-side sub-administrator permissions to advance a stage, while students can read only their own stage. The visibility query must expose only fields allowed by that stage. This design is not yet deployed.

### 19.5 Current implementation decision

Do not yet cut over `saveStudent()`, `renderReleaseResults()`, `renderStudentResults()` or `loadStudentPortalData()`. First design the release-stage schema and trusted permission checks, then implement the administrator result writer and student read adapter against official UUIDs. Keep subject-teacher draft/submission/approval workflow distinct from the staged release workflow. Acceptance tests must include all roles, class/session/term boundaries, inactive assignment denial, partial-stage visibility, final publication, and refresh on a second device.

No release-stage table, permissions table, result row or student record was changed or created in this audit. The only live database changes in this stage are the Subject Teacher result RLS policy hardening recorded in Section 18. Legacy browser data remains preserved.


## 20. Authoritative permission catalogue and sub-administrator gap — 9 November 2026

A read-only query found 18 permission catalogue entries, 58 role-to-permission mappings and 6 `profile_roles` records across the project. The catalogue already includes `enter_results`, `edit_results`, `submit_results`, `approve_results`, `publish_results`, `view_results` and related management permissions. Role-level mappings are not the same as individual sub-administrator grants.

For the DE-GLOBAL school, the current `profiles` role count is one active administrator, 18 active Form Masters, one active portal developer, one active student and one active Subject Teacher. No `sub_administrator` profile currently exists in this school's live profile records. The frontend's per-sub-administrator permission object therefore has no verified, school-scoped individual grant record in the live profile schema inspected so far.

This confirms that a secure migration of individual sub-administrator permissions needs a dedicated, authoritative per-profile grant model (or an equivalent server-verified design), not a client-side permission object and not merely the global `role_permissions` catalogue. The `permissions` table remains one of the previously identified RLS-enabled tables without policies. Do not expose it directly to the browser or grant broad access to resolve this gap. No permissions, roles or profiles were modified in this audit.


## 21. Individual Sub Administrator permission foundation deployed — 9 November 2026

### 21.1 Database model

Created two school-scoped tables:

- `profile_permission_grants` stores one grant per school, Sub Administrator profile and permission catalogue entry. It records the granting administrator, grant timestamp, active state and revocation actor/time. A unique constraint prevents duplicate grant rows.
- `profile_permission_grant_audit` records each grant and revocation. A database trigger writes the audit event in the same transaction as the grant change, so a successful permission mutation cannot commit without its corresponding audit event.

Both tables have RLS enabled. Direct table privileges are revoked from `anon` and `authenticated`; only the trusted server-side `service_role` path has table privileges. No client-facing RLS policy or broad Data API grant was added.

### 21.2 Trusted management endpoint

Deployed `manage-profile-permissions` Edge Function, version 2, with JWT verification enabled. It supports `list`, `grant` and `revoke`. For every request it verifies the JWT caller against the live `profiles` row and requires an active School Administrator. The target must be an active `sub_administrator` profile in the same school. The function derives school and actor identity from the verified caller, not from client-supplied values.

The initial delegation allowlist is limited to operational permissions: `view_results`, `enter_results`, `edit_results`, `submit_results`, `view_reports`, `manage_comments`, `manage_fees`, `manage_students`, `manage_classes` and `manage_subjects`. High-impact permissions such as approving/publishing results, managing users, managing the school and managing sessions are not individually delegable through this endpoint.

### 21.3 Verification and limits

- Both tables were created successfully with RLS enabled.
- The grant and audit tables have no `anon` or `authenticated` table privileges.
- The audit trigger is installed; grant/revoke audit writes are transactionally coupled to the row change.
- The Edge Function is ACTIVE at version 2 and JWT verification is enabled.
- No active Sub Administrator profile currently exists for this school. Therefore, no grant was issued and no positive authenticated role-session test could yet be run. The endpoint is deployed, but the frontend permission-management screen and end-to-end Sub Administrator result authorisation are not yet integrated.
- Existing roles, profiles, result rows and legacy browser permission values were not modified or imported.

### 21.4 Next gate

Create or verify an authorised Sub Administrator account through the existing administrator provisioning workflow, then integrate the administrator UI with this Edge Function. Next, implement a server-side permission check in every Sub Administrator result mutation/read route; do not rely on the legacy `currentUser.permissions` object. Only after that should the separate progressive result-release-stage table and administrator result writer be implemented. Browser result storage remains preserved for rollback.


## 22. Sub Administrator account, permission UI and result-policy integration — 9 November 2026

### 22.1 Account administration moved to Supabase

Replaced the legacy browser-backed Sub Administrator editor with a database-backed administrator interface. The screen now lists profiles with role `sub_administrator`, creates accounts through the JWT-protected `manage-sub-administrator` Edge Function, stores staff ID/designation/responsibilities in `sub_administrator_details`, supports activation/deactivation and password reset, and does not delete Auth users or profiles. Temporary passwords are generated server-side and shown to the administrator only after successful account creation/reset.

The details table has RLS enabled and no direct `anon` or `authenticated` table privileges. The Edge Function independently verifies an active School Administrator and derives the school scope from that administrator's profile.

### 22.2 Individual permissions now drive login

The `manage-profile-permissions` function is now version 3. It adds the `my_permissions` action for a signed-in Sub Administrator and returns only that profile's active grants. The frontend no longer reads `currentUser.permissions` from the legacy `subAdministrators` browser array. It obtains the active grants from the verified Edge Function and uses them to construct the visible feature permissions.

The administrator interface offers only the approved delegable permission catalogue entries: view results, enter results, edit results, submit results, view reports, manage students, teachers, classes, subjects, comments and fees. Approval/publication, user administration, deletion and school-wide settings are not offered as individual grants.

### 22.3 First-login password change

New Sub Administrator accounts and administrator-issued password resets set `profiles.must_change_password = true`. The login flow now routes those accounts to the existing secure password-change screen before granting application access. A new JWT-protected `change-sub-administrator-password` function validates a strong password, updates the authenticated user's Auth password and clears the profile's must-change flag. The new account's temporary password is not stored in browser persistence or the profile table.

### 22.4 Result access policies tightened

Removed the previous broad Sub Administrator result SELECT policy. The replacement policy requires an active Sub Administrator profile in the same school and at least one active individual grant for `view_results`, `enter_results`, `edit_results`, `submit_results` or `view_reports`.

Added the narrowly scoped `public.has_profile_permission(text)` SECURITY DEFINER helper. It uses the caller's `auth.uid()`, checks the caller's active Sub Administrator profile and active school-scoped grant, has a fixed search path, is not executable by `anon`, and is executable by `authenticated` users only for checking their own effective permission.

Also added database policies for Sub Administrator result INSERT (draft only, `entered_by` must be the caller, permission `enter_results`, and student/class/subject/session/term must all belong to the same school with a matching non-archived enrolment), UPDATE of the caller's own draft rows (`edit_results`), and draft-to-submitted transition (`submit_results`). Sub Administrators still cannot approve or publish results; those remain administrator-only workflow steps. No result rows were inserted or changed.

### 22.5 Deployment and verification boundary

Deployed and recorded the source for `manage-sub-administrator` (version 1), `manage-profile-permissions` (version 3) and `change-sub-administrator-password` (version 1). Updated the frontend and added a migration source file at `supabase/migrations/202611090001_subadministrator_permissions.sql`.

Live verification confirmed the permission-check helper is not executable by `anon`, is executable by `authenticated`, and the old unrestricted Sub Administrator result policy is replaced. The school still has zero Sub Administrator profiles, so no account was created during this maintenance pass and no real authenticated Sub Administrator grant/login/result transaction could yet be tested. The interface and server routes are deployed but require administrator acceptance testing with an authorised account before this workstream is marked fully accepted.

No legacy browser records, existing school staff profiles, students, enrolments or result rows were deleted or imported. The older aggregate administrator `saveStudent()` flow and progressive result-release workflow remain to be migrated; the new RLS policies do not by themselves complete that frontend cutover.


### 22.6 Legacy browser Sub Administrator persistence retired from the active code path

The frontend no longer loads `subAdministrators` from `cloudStorage`, writes that array through `saveAllData()`, or imports it into the public portal/staff-directory display. The administrator account screen and login permission source now use the Supabase profile and grant endpoints exclusively. The old browser backup is preserved as a rollback/evidence artefact; no browser key or backup file was deleted. Existing legacy Sub Administrator credentials and permission objects are not trusted or imported. Any required legacy account must be verified and provisioned through the new administrator workflow.


### 22.7 Edge Function deployment correction

After reviewing the deployed TypeScript sources, both list endpoints were adjusted to construct explicitly typed Maps rather than relying on tuple inference. The corrected functions are now deployed and ACTIVE: `manage-profile-permissions` version 4 and `manage-sub-administrator` version 2. Their matching GitHub source files were updated. JWT verification remains enabled on both functions. `change-sub-administrator-password` remains ACTIVE at version 1.


## 23. Progressive student result release foundation and portal endpoint — 9 November 2026

### 23.1 Separate release-stage records

Created `student_result_release_stages`, uniquely scoped to school, student, academic session and term. The stage range is constrained to 0–4: no release, first CA, second CA, third CA and final result. This is separate from `results.status`, which continues to represent the independent draft, submitted, approved and published workflow.

Created `student_result_release_stage_audit` and a database trigger. Stage insertions and actual stage changes are recorded with old stage, new stage, student/session/term scope and the authenticated administrator profile recorded as actor. Both tables have RLS enabled; `anon` and `authenticated` have no direct table privileges. The trusted server-side service role is the only direct application access path.

### 23.2 Server-side release management

Deployed `manage-student-result-release` with JWT verification enabled. It verifies an active School Administrator from the live `profiles` row and derives school scope from that profile. It lists official active enrolments, returns release metadata for the selected session and term, and allows one-stage-at-a-time advancement or revocation to stage 0. Advancement is refused unless at least one subject result for the student/session/term has already reached `published`. The endpoint does not approve or publish result rows.

### 23.3 Stage-filtered student result endpoint

Deployed `student-results-portal` with JWT verification enabled. It requires an active `student` profile and a matching `students.profile_id` record in the same school. It reads only the student's own stage records and published subject results, then constructs a reduced response:
- Stage 1: subject and CA1 only.
- Stage 2: subject, CA1 and CA2.
- Stage 3: subject, CA1, CA2 and CA3.
- Stage 4: subject, all assessment components, total, grade and remark.

The endpoint does not return unreleased columns in earlier-stage responses. Student authentication is based on the linked Supabase profile, not an admission-number-only filter or a browser-held student password.

### 23.4 Frontend cutover and remaining security gate

The administrator release screen now loads classes, sessions and terms from Supabase and invokes the server-side release manager. It no longer changes the legacy browser `students` array or calls `saveAllData()` to advance a release stage. The student result screen now invokes the stage-filtered endpoint and renders only the fields returned for that stage.

**Security cutover completed:** after the stage-filtered student renderer was committed and the GitHub Pages workflow succeeded, the direct RLS policy `Students can view their own published results` was removed. Student result delivery now routes through `student-results-portal`, which returns only the fields allowed by the student's stage. Other role-specific result SELECT policies remain in place. Structural verification confirmed that the student policy count is zero. A real authenticated student acceptance test is still outstanding; do not mark the student portal fully accepted until a linked student account is tested against both the Edge Function and direct Data API access. No student stage records or result rows have been created during this implementation pass.

### 23.5 Verification and limits

- Both release tables exist, have RLS enabled, and have no `anon` or `authenticated` SELECT privilege.
- `manage-student-result-release` and `student-results-portal` are ACTIVE with JWT verification enabled.
- Frontend code was committed to the repository. Hosted GitHub Pages deployment and authenticated acceptance tests are not yet confirmed.
- Existing result table count remains 0, so there are currently no published result rows available to release.
- The legacy browser backup remains untouched. The administrator's aggregate result-entry workflow and Form Master assessment persistence are still separate migration work and are not declared complete.

## 23. Progressive student result release moved to Supabase — 9 November 2026

### 23.1 Separate release-stage data model

Created `public.student_result_release_stages`, scoped by school, official student UUID, academic session and term. The stage is constrained to 0–4:

- 0 — no result release;
- 1 — first CA;
- 2 — first and second CA;
- 3 — first, second and third CA;
- 4 — final result.

A unique constraint prevents duplicate stage records for the same student/session/term. The table has RLS enabled and direct table privileges are revoked from `anon` and `authenticated`; access is through trusted server-side functions. A separate `student_result_release_audit` table records the previous and new stage, action, actor and timestamp. A database trigger writes the audit event in the same transaction as a stage change. No stage or audit rows were created during deployment.

The approval workflow remains separate. Stages 1–3 require at least one approved or published result row. Stage 4 requires at least one published result row. Advancing is one stage at a time; an administrator may reset a student's release to stage 0. The release action does not approve or publish a result row.

### 23.2 Trusted release management endpoint

Deployed `manage-student-result-release` with JWT verification enabled. It verifies the caller against the active School Administrator profile, derives the school scope from that profile, validates the session, term, student and active enrolment, and records stage changes through the audited table. Its list action returns official enrolment identities, class labels, current stages and eligible result-row counts. The browser cannot directly write release-stage records.

### 23.3 Student result response is stage-filtered on the server

Deployed `get-student-result-release` with JWT verification enabled. It requires an active Student profile and resolves the official student record through `students.profile_id = auth.uid()`. It does not use an admission-number-only lookup.

The endpoint returns only the permitted fields:
- Stage 1: subject and first CA;
- Stage 2: adds second CA;
- Stage 3: adds third CA;
- Stage 4: adds examination, total, grade and remark, and only for published result rows.

The endpoint does not return hidden score columns, result status, or another student's records. The student-facing result screen now calls this endpoint and no longer reads the legacy aggregate result batches for result display. The old browser backup remains preserved.

### 23.4 Frontend changes and deployment boundary

The administrator Release Results screen now loads sessions, terms, classes and active enrolments from Supabase. It offers per-student, one-stage-at-a-time release and displays the current stage and eligible result-row count. The student result screen groups the server-filtered response by session and term.

The frontend change was committed to `main` as `6dfbaa3987273132e6f9fa42cff0cf298d06ecc2`, and the associated GitHub Pages workflow completed successfully. Later administrator result-entry changes are recorded in Section 24 and have their own deployment status. The live `pg_policies` inventory checked after deployment contains no Student SELECT policy on `public.results`. Student result access is therefore not available through a direct results-table SELECT policy; the authenticated student endpoint is the intended retrieval path. The student Data API denial should still be confirmed in the authenticated acceptance test.

### 23.5 Verification and remaining acceptance tests

Live verification confirmed:
- both new release tables exist with RLS enabled;
- neither table grants direct table privileges to `anon` or `authenticated`;
- the service-role server path has the required table privileges;
- the release-stage and audit tables contain zero rows;
- `manage-student-result-release` is ACTIVE at version 5 with JWT verification;
- `get-student-result-release` is ACTIVE at version 2 with JWT verification;
- the school still has zero result rows, so no result data was changed.

No student, staff, enrolment, result or legacy browser record was modified. No test account was created. Because there are currently no result rows and no authorised test student session was used, positive and negative authenticated stage tests remain outstanding. Before removing the direct student SELECT policy, test the student endpoint with a real linked student account at stages 0, 1, 2, 3 and 4, including a cross-student denial and a direct Data API denial after policy removal. Also verify that stage 4 excludes approved-but-not-published rows and that an authenticated Student cannot SELECT directly from `public.results`.

### 23.6 Next implementation boundary

The administrator/sub-administrator aggregate `saveStudent()` workflow is still not migrated. It must be replaced with a trusted Supabase result writer that maps subject scores to `results`, Form Master assessment values to `form_master_student_assessments`, and preserves official identity/enrolment in their existing tables. Server-side validation must enforce active profile, school/session/term/class/subject/enrolment, assessment maxima and draft-only writes. Do not retire the legacy result backup until administrator entry, submission, approval, publication, progressive release and student cross-device retrieval all pass acceptance tests.


### 23.6 Direct student result-table access closed — 9 November 2026

Removed the RLS policy `Students can view their own published results`. This closes the direct Data API route that would otherwise expose every column of a published result row regardless of progressive stage. The stage-filtered `student-results-portal` Edge Function is now the student-facing result retrieval route. The table remains accessible to the other authorised roles through their separate RLS policies; this change did not remove administrator, Form Master, Subject Teacher or individually authorised Sub Administrator access.

Live structural verification returned zero policies with the former student policy name. The school still has zero result rows and zero release-stage rows, so no student data was affected. An authenticated student-session test is still required to confirm the full live experience and verify direct student SELECT is denied.

## 24. Administrator result entry moved to official Supabase records — 9 November 2026

### 24.1 Atomic, server-validated result writer

Created `public.save_admin_student_result_batch` as a transaction-scoped database function and exposed it only through the JWT-verified `save-admin-student-results` Edge Function. The database function is SECURITY DEFINER with a fixed search path. Execution is revoked from `PUBLIC`, `anon` and `authenticated`; only `service_role` can execute it. The Edge Function derives the actor from the verified JWT and supplies that actor ID to the database function.

The database function checks the active profile and school, requires the Administrator role or an active Sub Administrator with the individual `enter_results` or `edit_results` grant, validates the official student, active enrolment, class, academic session, term and active assessment configuration, resolves each subject against the active subject catalogue for the class section, validates every score against the configured CA/examination maxima, and writes draft result rows. A Sub Administrator can create new rows only with `enter_results`; editing an existing row requires `edit_results` and the row must be that Sub Administrator's own draft. Submitted, approved or published rows cannot be overwritten by this entry endpoint.

Subject result rows are upserted using the unique student/subject/session/term key. The operation also supports saving the Form Master assessment fields to `form_master_student_assessments` in the same database transaction. It does not approve, submit or publish results.

### 24.2 Official student and subject selection

The Administrator/Sub Administrator manual entry screen now loads the student register from active `student_enrolments` joined to official `students` records for the selected Supabase class and active session. The student UUID, admission number, date of birth and gender come from those official records. The screen no longer generates the selected student's identity from a browser-held register number or student-name array.

Subject choices now load from the active Supabase `subjects` catalogue using the class section (`basic` or `senior`). Trade subjects are populated from the same catalogue. The server independently resolves and validates the subject name and section, so browser-supplied labels are not trusted as subject identity.

The administrator now has an explicit class-arm selector. Scores are sent to `save-admin-student-results` and stored as `draft` rows in `public.results`; the frontend no longer calls `saveAllData()` to persist the entered aggregate result.

### 24.3 Grade-scale reconciliation

The legacy administrator aggregate entry code used thresholds of 75/65/55/40 and labelled the lowest band E. The existing Supabase Subject Teacher score sheet uses 80/70/60/50 and labels the lowest band F. To prevent two active entry paths from assigning different grades to the same score, the new administrator writer and its score preview use the existing Supabase Subject Teacher scale: A (80+), B (70+), C (60+), D (50+), F (below 50). This is a deliberate alignment of the new Supabase writer; the old browser aggregate remains preserved as a rollback reference and is not imported.

Passport photos and Form Master signature images are not embedded in result rows. The new manual score-entry screen directs those assets to their separate official profile/private-storage workflows. The Form Master comment, affective and psychomotor ratings, attendance, school days and next-term fees are sent as structured data to the Form Master assessment table.

### 24.4 Verification and deployment boundary

Live verification confirmed:
- `save_admin_student_result_batch` exists as a SECURITY DEFINER function with a fixed search path;
- migrations `202611090004_harden_admin_result_score_validation.sql` and `202611090005_fix_admin_result_subject_uuid_lookup.sql` hardened required score values, duplicate subject detection and the subject UUID lookup;
- a controlled negative database test used an existing official BASIC7A enrolment and an over-limit CA1 value; the writer rejected the request before writing, and the school result-row count remained zero;
- `anon` and `authenticated` do not have EXECUTE permission; `service_role` does;
- `save-admin-student-results` is ACTIVE at version 1 with JWT verification enabled;
- the school currently has zero result rows and zero Form Master assessment rows;
- no student, enrolment, result or legacy browser record was changed during implementation.

The frontend changes were committed to `main` in commits `4dcf808bc70877f2ba7283f5f4acee6deae4d258`, `a936c564783a7d60dbfabd56ce672437c04a6415`, `a978869b18a56f8050ad572c3c5884726728d9c7`, `7ac138dafd9321cbff09f78c7190068d7dba8c8c` and `2865d06cbdff3d098c535749059f634a1df520b5`. The GitHub Pages workflows for the latest class-selector and roster-reset commits both completed successfully.

No real result entry was performed because the school has no result rows and no authenticated Administrator/Sub Administrator acceptance transaction was run. The negative validation test is not a substitute for a positive save/upsert test. The function and frontend are structurally deployed/committed, but role-session acceptance remains outstanding. Test a new draft, a repeat save/upsert, assessment maximum rejection, inactive enrolment denial, cross-school denial, Sub Administrator without a grant, Sub Administrator own-draft edit, and denial when attempting to overwrite a submitted/approved/published row.

### 24.5 Remaining result lifecycle work

The manual writer now stores the subject result rows and the structured Form Master assessment values, but it does not yet replace every legacy report-card consumer. Continue by migrating result report assembly, class averages/positions, attendance/fees display, comments and signatures to Supabase and private Storage. Then verify submission, administrator approval, final publication, progressive stage visibility and student retrieval on a second device.

The current live policy inventory contains no Student SELECT policy on `public.results`; the stage-filtered Edge Function is the student-facing retrieval path. Keep this restriction in place and include a direct Data API denial test in acceptance testing.


## 25. Progressive Student Result Release — Supabase Stage Control

### 25.1 Purpose and separation of concerns

Progressive result visibility is now represented independently from result approval and publication. The release stages are scoped to one school, student, academic session and term:

| Stage | Student-visible fields |
|---|---|
| 0 — Not released | No result rows |
| 1 — First CA | Subject and CA1 |
| 2 — Second CA | Subject, CA1 and CA2 |
| 3 — Third CA | Subject, CA1, CA2 and CA3 |
| 4 — Final | Subject, all CA scores, examination, total, grade and remark |

Stages must be advanced in order, one stage at a time. The School Administrator can revoke all stages for an individual student and term. This does not change the result's approval or publication status.

### 25.2 Database records and audit

Migration `202611090002_student_result_release_stage.sql` creates:
- `student_result_release_stages`, uniquely scoped by school, student, session and term, with a stage constraint from 0 to 4;
- `student_result_release_audit`, recording previous and new stage, action, actor and timestamp;
- a database trigger that writes an audit record whenever a stage is created or changed.

Both tables have RLS enabled and no direct `anon` or `authenticated` table grants. The service role is used only from JWT-authenticated Edge Functions after the caller's profile, role, active status and school scope have been verified. The audit table is append-only from the application path.

### 25.3 Roles and permissions

- Only an active School Administrator can list students for release, advance a stage or revoke all stages.
- Sub Administrators do not receive release-stage control through their individual permission grants.
- Students cannot query the release tables or the full result table directly.
- The student retrieval endpoint derives the student from the authenticated profile and the official `students.profile_id` link. It does not accept an admission number or student ID as an authority selector.

### 25.4 Administrator operation

1. Sign in as the School Administrator and open **Release Results**.
2. Select the academic session, term and optionally a class arm.
3. Review each student's official active enrolment, result eligibility count and current release stage.
4. Select **Release 1st CA**, then repeat for the next stages when ready.
5. The endpoint requires approved or published result rows for stages 1–3. Stage 4 requires published rows.
6. To withdraw visibility, select **Revoke All** and confirm. The stage is reset to 0 and the audit trigger records the change.

The server checks school ownership, active enrolment, session and term scope, stage order and result status. UI button state is only a convenience; server validation remains authoritative.

### 25.5 Student retrieval and field filtering

The active `student-results-portal` Edge Function is deployed with JWT verification. It verifies the active Student profile and linked official student record, reads that student's release stages, and returns only the permitted fields. For stages 1–3, approved or published rows may be returned with only the CA fields allowed at that stage. Stage 4 returns only published rows and includes the examination, total, grade and remark.

The student screen continues to use this established endpoint and its grouped response format. It does not read the browser's legacy aggregate result objects. The direct `results` table policy inventory contains no Student SELECT policy, so the student cannot bypass field filtering through the Data API.

### 25.6 Verification and outstanding acceptance

- The release-stage migration applied successfully.
- `manage-student-result-release` is ACTIVE with JWT verification and administrator-only role checks.
- `student-results-portal` is ACTIVE at version 3 with JWT verification and stage-aware field filtering.
- The administrator release UI reads eligibility counts from the release function and includes a revoke-all control.
- No stage rows or audit rows existed at the time of the live baseline check; no student results were fabricated or changed.
- No real student account test was performed. The school must complete authenticated Administrator release and Student retrieval tests after deployment, including all five stages, stage reset, unauthorised role denial, cross-school denial and direct Data API denial.

A separate experimental endpoint, `get-student-result-release`, was deployed during the reconnection attempt but is not called by the current frontend. The production student portal remains `student-results-portal`; do not switch clients to the experimental endpoint without a separate compatibility review.

### 25.7 Remaining work

The administrator result-entry writer is documented in Section 24. The next acceptance work is a positive authenticated draft save/upsert and the full workflow from submission through approval, publication, progressive release and student retrieval. Then complete the report-card and class summary consumers using Supabase result rows and structured Form Master assessments. Preserve the legacy browser backup until those workflows pass on an authenticated account and a second device.


### 25.8 Final-stage eligibility refinement

The release-management endpoint now returns separate approved/published eligibility and published-only counts. The administrator interface uses the approved/published count for CA stages and the published-only count for the final stage. This prevents the interface from offering the final release action when only approved, but not yet published, subject results exist. The **Revoke All** control resets a student's term stage to 0 through the same administrator-authenticated endpoint and records the change in the database audit table.
