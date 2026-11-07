# Legacy Browser Data Classification — Phase 3

**Project:** DE-GLOBAL ACADEMY GBOKO  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Source backup:** `DE-GLOBAL-LEGACY-BROWSER-BACKUP-2026-11-07T07-37-47-403Z.json`  
**Backup timestamp:** 2026-11-07 07:37:47 UTC  
**Review date:** 2026-11-07  
**Mode:** Read-only inspection; no Supabase or browser data was changed.

## 1. Executive outcome

The uploaded browser snapshot is valid and readable. It contains 43 localStorage keys and 16 IndexedDB records. Every IndexedDB record has a matching school-UUID-prefixed localStorage key, and all 16 values are identical between the two stores. This means the IndexedDB set is a duplicate copy of the same 16 records, not 16 additional independent records.

The backup is **not a complete legacy-data backup**: the optional `window.storage` interface was unavailable, so no records were read from it; dynamic key families could not be enumerated; Chrome cookies and Supabase authentication tokens were excluded by design. No conclusion should be drawn that no other legacy records exist outside the captured stores.

No student names, student batches, result marks or populated class student-name arrays were found in the captured localStorage/IndexedDB records. This does not affect the 743 student records and 743 active enrolments already present in Supabase; those remain the authoritative current student/enrolment baseline.

## 2. Snapshot integrity

| Check | Finding |
|---|---:|
| localStorage keys exported | 43 |
| IndexedDB records exported | 16 |
| IndexedDB keys also present in localStorage | 16 of 16 |
| IndexedDB values equal matching localStorage values | 16 of 16 |
| Authentication keys excluded | 2 |
| `window.storage` available | No |
| `window.storage` records read | 0 |
| localStorage / IndexedDB read error | None reported |
| Supabase database writes | None |

The two authentication keys remain intentionally excluded. Do not attempt to restore or migrate authentication tokens from this backup.

## 3. Classification results

| Category | Captured evidence | Classification | Decision |
|---|---|---|---|
| School identity/configuration | UUID-prefixed `schoolInfo`, legacy `school:main`, and empty `MAIN:schoolInfo` | Reconciliation/cache | Compare only supported school fields against the confirmed `schools` row. The legacy `school:main` object uses `MAIN` as its school ID, not the confirmed school UUID. Do not treat `MAIN` as a database school identifier. |
| Class arms | Two equivalent 30-item arrays: `MAIN:classArms` and UUID-prefixed `classArms` | Duplicate legacy configuration | The 30 class names align in count with the 30 existing Supabase classes, but exact ID/name reconciliation is still required. Every captured legacy class is inactive, has blank Form Master fields, and has 100 empty student-name slots and 100 empty student-sex slots. Do not import these arrays or use their slot arrays as student records. |
| Legacy class passwords | Password-like fields embedded in each class-arm object | Security exposure | Do not migrate or reproduce them. If any are still accepted by a live login path, replace them through the approved account workflow. Do not assume they are active credentials without checking the current code path. |
| Assessment configuration | 30 class-name entries in `MAIN:assessmentConfig`; each has CA1 10, CA2 10, CA3 10 and examination 70 | Reconciliation required | Existing Supabase baseline has 6 assessment configurations. Compare class level, session, term, active state and maxima before any write. Do not create 30 rows merely because 30 legacy entries exist. |
| Subject assignment | One UUID-prefixed Mathematics assignment for BASIC7A; legacy `teacherId` is blank | Unresolved assignment | Class and subject IDs are present, but teacher identity must be resolved to an authenticated teacher profile and the academic session before comparison with the one existing Supabase teacher assignment. Do not insert a duplicate or infer the teacher UUID from email/name. |
| Staff database | Four UUID-prefixed legacy staff entries; one separate `MAIN:staffDatabase` entry | Reconciliation only | Existing Supabase `school_staff_directory` baseline has 15 rows. No automatic import. Compare stable identifiers/profile links and current fields first. The separate MAIN entry is not automatically a fifth school staff record. |
| Other staff arrays | `schoolStaff`, `managementStaff`, `formMasters`, `subAdministrators`, `portalStaffSelections` are empty in the school-prefixed snapshot | Empty legacy collections | No rows to migrate from these captured arrays. This does not replace or override current Supabase staff, profile or role records. |
| Student metadata/imports | Both captured `students_meta` objects report zero batches and zero students; no `students_batch_*` key was captured | No student payload in this snapshot | Do not import or overwrite students/enrolments. Supabase remains at 743 students and 743 active enrolments. The unavailable `window.storage` interface and dynamic key limitation prevent a claim that no other browser-only student data exists. |
| Activity log | Seven school-prefixed activity entries; the IndexedDB copy is identical | Historical audit evidence | Preserve in the private source backup. No confirmed destination audit-log table was identified in the supplied schema inventory. Do not discard or write into an unrelated table. |
| Portal news | One school-prefixed announcement record; MAIN copy is empty | Review/hold | Do not publish or migrate automatically. Verify whether it is genuine and whether an announcements table and secure access policy are approved. |
| Portal settings | UUID-prefixed settings include welcome text, term length, portal flag and licence/sales metadata; MAIN settings are a different default object | Mixed configuration and privileged metadata | Separate ordinary school presentation settings from licence, sales and developer-controlled fields. No confirmed settings table exists in the supplied schema. Never trust browser licence fields as authority. |
| ID-card settings | Fee/discount values, expiry date and admission/email permission flags | Review/hold | The stored validity date is 2026-10-31, which is before the backup date. Do not migrate expired permissions or pricing as active policy. No confirmed destination table was supplied. |
| Signatures and stamp | One subject-signature image, signature-subject list, and school-stamp image embedded as data URLs | Asset migration deferred | Preserve privately. Before upload, define a private Storage bucket/path, file validation, metadata relationship and scoped policies. Do not place base64 image content in URL columns or expose it publicly. |
| Developer profile | Browser-global developer profile and embedded image/contact fields | Exclude from school migration | Not a school operational record. Do not copy developer contact details, access grants or image data into school tables. |
| UI preferences / unrelated app data | Theme keys, SDP menu position and CodeForge workspace key | Exclude | Not DE-GLOBAL school records. Leave them out of the school migration. |
| Activation marker | Boolean legacy activation/reset marker | Retire only after code-path review | Treat as a migration/version marker, not business data. Do not copy it to Supabase. |

## 4. Important cross-checks against the known Supabase baseline

The supplied database baseline reported:

- 743 students and 743 student enrolments (743 active).
- 30 classes.
- 51 subjects.
- 1 academic session and 3 terms.
- 6 assessment configurations.
- 1 teacher assignment.
- 15 school staff directory records.
- 29 student import batches and 838 import rows.
- 0 results and 0 Form Master student assessments.

The backup's class-arm count is 30, but matching counts alone do not prove that each legacy class is the same row as its Supabase counterpart. The one legacy teacher assignment is not proven to be the same as the existing Supabase assignment. The legacy assessment settings are not proven to match the six current Supabase configuration rows.

## 5. Migration decisions

### Eligible for a read-only comparison next
1. School identity and basic school fields.
2. The 30 class names against Supabase `classes`.
3. Assessment maxima against the six existing `assessment_configurations`.
4. The one subject assignment against the existing teacher assignment, after resolving the teacher profile.
5. The four legacy staff entries against the 15 Supabase staff-directory rows.

### Deferred pending design, authorisation or further evidence
- Signature and stamp assets.
- Portal news, portal settings and ID-card settings.
- Activity/audit history.
- Any records potentially held only in `window.storage` or dynamic key families.
- Any class password or legacy credential.

### Explicitly not authorised
- Student or enrolment import from this backup.
- Bulk staff import.
- Bulk class or assessment configuration upsert.
- Teacher assignment creation or reassignment.
- Public exposure of staff/signature/stamp data.
- Deletion of browser data, Supabase rows, or the original backup.

## 6. Security and preservation actions

1. Keep the original JSON backup private and unchanged.
2. Keep the original Chrome profile's browser storage intact.
3. Do not publish the backup or place it in a public repository.
4. Do not copy the embedded image payloads or personal details into this report.
5. Review whether the class-arm password fields are still consumed by any login path; if so, replace those credentials through an authorised workflow.
6. Keep Supabase RLS enabled and use existing Edge Functions/RPCs for privileged operations.
7. Treat preview and live as the same database environment; preview writes are real writes.

## 7. Phase 3 exit status

**Classification completed for the captured snapshot.** The result is a dry-run classification only. It does not certify that the browser export is exhaustive, and it does not authorise database writes.

**Next gate:** Phase 3B read-only reconciliation of school identity, classes, assessment configurations, teacher assignment and staff directory against current Supabase rows. The user must run any supplied SQL in Supabase SQL Editor; the assistant does not execute SQL directly.
