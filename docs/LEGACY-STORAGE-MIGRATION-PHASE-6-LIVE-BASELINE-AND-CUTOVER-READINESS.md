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
