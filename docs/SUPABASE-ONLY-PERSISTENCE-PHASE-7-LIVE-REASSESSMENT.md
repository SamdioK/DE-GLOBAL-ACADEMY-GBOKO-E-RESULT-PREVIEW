# Supabase-Only Persistence — Phase 7 Live Reassessment

**Project:** DE-GLOBAL ACADEMY GBOKO E-RESULT SYSTEM  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Branch:** main  
**Review date:** 9 November 2026  
**Mode:** Source and live-schema inspection; no production records changed  
**Purpose:** Reassess remaining non-Supabase persistence and define safe migration order.

## 1. Executive finding

The application is still not entirely Supabase-backed. The active `index.html` contains a legacy `CloudStorage` abstraction that writes and reads `window.storage`, IndexedDB (`EResultDB`) and `localStorage`. It is still called by application load, save-all, administrator, student portal and public portal workflows.

The score-entry preference path is already Supabase-backed. The separate `supabase-persistence.js`, `score-entry-engine.js` and `passport-registration.js` files contain no direct browser persistence calls in this inspection. `index.html` has one additional `sessionStorage` use for password-reset operation coordination; it is temporary retry/idempotency state, not the authoritative reset record, and must be replaced only with a safe Supabase-backed idempotency flow.

No browser storage was deleted, no database records were imported, and no schema changes were made during this reassessment.

## 2. Exact remaining browser persistence

### 2.1 Legacy storage implementation

The active `CloudStorage` class in `index.html`:
- Opens IndexedDB database `EResultDB`, object store `data`.
- Writes to `window.storage`, IndexedDB and `localStorage`.
- Reads from those stores in sequence.
- Returns success if any one legacy store accepts a write; it does not prove that Supabase was written.

This is a critical false-success path. `saveAllData()` calls the legacy store and can return true without a database write.

### 2.2 Active call sites and domains

The live source still calls `cloudStorage.load/save/globalLoad/globalSave` for these categories:

| Domain/key family | Current state | Correct destination |
|---|---|---|
| `classArms` | Legacy load/save remains; class and arm identities already exist in DB | `classes`; Form Master relationships in `form_master_assignments`; remove embedded student-name arrays and password fields |
| `formMasters` | Legacy load remains; account identity/roles are DB-backed | `profiles`, `profile_roles`, `form_master_assignments` |
| `subjectAssignments` | Legacy load/save remains; direct DB assignment module exists | `teacher_assignments` and related class/subject/session IDs |
| `schoolInfo` | Legacy object still loaded, but authoritative school identity is refreshed from `schools` | `schools` plus Storage object paths for image assets |
| `managementStaff` | Legacy load/save remains | Existing profiles/role records or a specifically designed management assignment relation; do not duplicate identities |
| `subAdministrators` | Legacy key remains in old state/save pathways | `profiles`, `profile_roles`, `sub_administrator_details` |
| `activityLog` | Legacy source remains in save-all; administrator read already uses DB audit | `school_activity_audit`; preserve actor identity and timestamps |
| `portalNews` | Legacy load/save remains | Missing dedicated portal-news table; create school-scoped relational table and safe public read surface |
| `schoolStaff` / `staffDatabase` | Legacy values still loaded; staff database has direct DB integration | `school_staff_directory`; remove duplicate legacy collection only after checking every consumer |
| `portalStaffSelections` | Legacy load/save remains | DB relation/table linking approved staff directory IDs and visible fields |
| `prefects` | Legacy load/save remains | Missing prefect appointment table; relate to student/enrolment IDs |
| `dutyRoster` | Legacy load/save remains | Missing school-scoped duty roster table; relate to staff/profile IDs |
| `portalSettings` | Legacy load/save remains; contains mixed school presentation and platform/licensing fields | Separate school-owned portal settings from privileged platform licensing/sales metadata |
| `students_meta`, `students_batch_<n>` | Legacy register load/save remains in administrator path | `students` and `student_enrolments`; use DB counts, not local batch metadata |
| `signature_subjects`, `sig_<subject>` | Student portal still reads legacy signature index/content; administrator load already calls DB signature loader | `school_teacher_signatures` metadata plus private `school-private-assets` Storage paths |
| `schoolIdCardSettings` | Legacy settings loader remains | Missing dedicated school ID-card settings table; separate school settings from permissions/pricing policy |
| `activationResetV3` | Legacy one-time marker read/write remains | Remove obsolete browser marker after dependent activation logic is replaced by authoritative assignment/configuration state |
| `school:main`, `portal:developer` | Global legacy namespace | Do not import into school operational records; developer/platform profile requires separate privileged ownership |

The only direct `sessionStorage` use found in the application source is in the administrator student-password-reset workflow. The reset operation itself is already represented by Supabase reset-operation records/Edge Function logic. The temporary client retry state needs a server-backed idempotency review before removal.

## 3. Live Supabase destinations verified

Read-only live queries on 9 November 2026 returned:

| Table | Rows |
|---|---:|
| `students` | 743 |
| `student_enrolments` | 743 |
| `classes` | 30 |
| `assessment_configurations` | 6 |
| `teacher_assignments` | 1 |
| `school_staff_directory` | 15 |
| `results` | 0 |
| `school_activity_audit` | 8 |
| `school_teacher_signatures` | 2 |
| `score_entry_preferences` | 1 |

All 39 public base tables inspected have RLS enabled. `score_entry_preferences` has RLS forced. RLS being enabled does not by itself prove each policy is correct; each new or changed domain must receive a least-privilege policy review.

Existing Storage buckets and object counts:
- `school-private-assets`: 10 objects, private.
- `school-public-assets`: 1 object, public.
- `student-passports`: 8 objects, private.

No new bucket is needed until the existing buckets, object paths and policies are verified for the intended file category.

## 4. Legacy backup evidence and limits

The latest available browser snapshot is `DE-GLOBAL-LEGACY-BROWSER-BACKUP-2026-11-08T21-00-50-311Z.json`.

It contains:
- 43 localStorage keys.
- 16 IndexedDB records, duplicating the corresponding localStorage records in the earlier reconciliation.
- 30 legacy class-arm entries, which must be reconciled by stable class IDs against the 30 live DB classes; count equality is not proof of identity.
- One legacy subject-assignment object with an empty teacher ID; it must not be imported or used to create a new assignment without resolving the authenticated profile and comparing the existing DB assignment.
- One teacher signature data URL and a school stamp/signature image embedded in school data; binary content must be uploaded to private Supabase Storage and metadata reconciled before retiring local copies.
- One legacy portal-news record.
- Empty legacy prefect, duty-roster, Form Master, management-staff and school-staff arrays in the school-prefixed namespace.
- Student batch metadata indicating zero batches and zero students. This is not a student backup and must not overwrite the 743 live student/enrolment rows.
- Mixed portal settings, including school presentation settings and licensing/sales values. Platform licence data must never be accepted from a school-controlled browser object.

The snapshot reports that `window.storage` was unavailable and dynamic keys may not be enumerable. Therefore it is not an exhaustive export of every possible device/browser store. Do not delete the original browser profile data or treat this snapshot as a full recovery backup.

## 5. Migration sequence

### Phase 7A — Protect existing authoritative data and close false-success writes
1. Back up the live Supabase project and verify restore procedure.
2. Confirm all current `saveAllData()` callers and their module-specific meaning.
3. Replace the legacy generic save confirmation with explicit errors; do not claim that a local write is a Supabase save.
4. Do not silently switch to local storage when Supabase is unavailable.

### Phase 7B — Reconcile and cut over already modelled domains
1. School profile and branding assets.
2. Classes and Form Master assignments.
3. Teacher assignments and authenticated staff/profile roles.
4. Student register and enrolments.
5. Staff directory and public staff display selection.
6. Activity audit and teacher signatures.

For every domain, compare by stable IDs, read back the written record, verify counts/relationships, and test as the relevant role on a second device before retiring legacy reads.

### Phase 7C — Add missing relational domains
Design and implement only after schema and permission review:
- Portal news/announcements and public read projection.
- Portal settings, with school-owned presentation values separated from platform/licensing controls.
- Prefect appointments.
- Duty roster.
- ID-card settings and permissions.
- Portal staff field selections if not already represented.

Do not store every category in one unrestricted JSON blob. Use relational tables, foreign keys, constraints, audit history and narrowly scoped RLS policies.

### Phase 7D — File migration
- Upload signature, stamp and logo files to appropriate existing private/public Storage buckets.
- Verify MIME type, size, object path, ownership and access policy.
- Store only Storage paths and metadata in Postgres.
- Generate signed URLs for private files.
- Verify the rendered asset before removing any legacy base64 copy.

### Phase 7E — Remove browser persistence
After all reads and writes are cut over:
- Remove `CloudStorage`, IndexedDB initialization, `window.storage`, and all localStorage persistence.
- Replace password-reset session retry state with verified server-side idempotency.
- Remove obsolete migration flags and stale browser data paths.
- Add automated checks preventing new application persistence in browser storage.
- Test offline/failure behaviour: failed Supabase writes remain visibly failed; no local fallback.

## 6. Safety gates

- Do not import the empty legacy student batch metadata or empty roster arrays over live database records.
- Do not import the legacy assignment with unresolved teacher identity.
- Do not import the legacy class password fields or any embedded credentials.
- Do not duplicate staff identities already represented in `profiles` or `school_staff_directory`.
- Do not publish private signature/stamp assets.
- Do not migrate browser-supplied licence or sales fields into an authoritative platform permission model.
- Do not delete any browser data, Supabase rows, Storage objects or backup files during reconciliation.
- The preview and live site share the same Supabase project; preview writes are production writes.

## 7. Completion criteria

The system is not certified Supabase-only until:
1. All active application modules use Supabase Database, Supabase Storage or Supabase Auth for durable data.
2. No active application code persists durable records to localStorage, sessionStorage, IndexedDB, Cache API, cookies or `window.storage`.
3. Every write is confirmed by the authoritative Supabase response and read-back where required.
4. All legacy data categories are reconciled and their counts/relationships verified.
5. Public access exposes only approved fields.
6. Each role passes access and cross-school negative tests.
7. A second authorised device sees the same saved records.
8. Browser persistence fallback code is removed and automated checks pass.
9. The full operational/training manual is updated for each completed phase.

**Phase 7 outcome:** Live source and database inventory completed. Migration blockers are classified. No production data has been changed in this reassessment. The next implementation work is Phase 7A followed by domain-by-domain cutover; a single global removal of browser storage would break active workflows and risk data loss.
