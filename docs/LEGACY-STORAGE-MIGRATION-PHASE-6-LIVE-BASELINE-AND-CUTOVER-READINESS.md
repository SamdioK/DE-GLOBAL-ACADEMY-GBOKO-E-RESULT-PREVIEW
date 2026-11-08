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
