# Phase 5A — Supabase-First Persistence Architecture and Migration Work Plan

**Project:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Branch:** `main`  
**Phase:** 5A — Persistence architecture, category sequencing and implementation gates  
**Mode:** Source inspection and implementation planning; no production database or browser data writes

## 1. Objective

Make Supabase the authoritative and permanent store for school data across devices. Browser storage must not be the authoritative source for student, staff, academic, assessment, results, school configuration, user permissions or portal records.

The application will use:
- **Supabase Database** for structured, relational school records and configuration.
- **Supabase Storage** for uploaded binary assets such as student passports, staff photographs, school logos, signatures and stamps.
- **Supabase Auth** for user identities, credentials and sessions.
- **Browser memory/session state** for temporary interface state only. A small non-sensitive preference cache may remain only where explicitly approved; it must never become the authoritative record.

## 2. Current verified starting point

Source inspection of `index.html` and `supabase-persistence.js` on 7 November 2026 confirms:

1. `index.html` still defines and instantiates the legacy `CloudStorage` implementation.
2. `CloudStorage.save()` and `globalSave()` write to optional `window.storage`, IndexedDB `EResultDB` and `localStorage`; they do not write to Supabase.
3. `CloudStorage.load()` and `globalLoad()` read those browser-side stores in that order.
4. `saveAllData()` still writes class arms, Form Masters, subject assignments, school information, management staff, sub-administrators, activity log, portal news, school staff, portal staff selections, prefects, duty roster, portal settings, student batches, student metadata and teacher signatures through the legacy layer.
5. The Staff Database has a separate Supabase persistence path and is excluded from the legacy `saveAllData()` write list.
6. `supabase-persistence.js` currently exposes generic authenticated CRUD helpers plus read-only audit methods and staff-directory methods. It is not yet a complete replacement for the legacy persistence API.
7. The existing school profile and class configuration screens still rely on legacy objects in important paths; an audit/read method does not prove that a category is fully migrated.
8. The source contains many direct legacy storage calls outside `saveAllData()`. Replacing only `saveAllData()` would therefore be incomplete.
9. The legacy browser backup from 7 November 2026 is a recovery aid, not a complete Supabase backup. Its optional `window.storage` source was unavailable when captured. Do not clear browser data.
10. The preview and live site share the same Supabase project. Any database write from either site is a real production write.

## 3. Non-negotiable safety rules

- Never put a service-role key, database password, access token or encryption key in frontend code, Git history or chat.
- Use the public anon/publishable key only in the browser; enforce RLS and server-side authorisation.
- Never trust a school ID supplied by the browser. Derive the active school from the authenticated user's active profile or validate it in a trusted server function.
- Do not create a generic JSON key/value table to avoid modelling the actual data.
- Do not directly create or mutate privileged profiles, role assignments, student enrolments, SIDs, import approvals, result approval states or published results from arbitrary browser code.
- Reuse existing Edge Functions, RPCs, database constraints and approval workflows after their behaviour has been verified.
- Do not overwrite non-empty Supabase values with blank or stale legacy values.
- Do not bulk import legacy student, staff or account arrays without record-level matching, conflict reporting, approval and reconciliation.
- Do not remove legacy reads/writes or clear browser storage until that category has passed the cutover checklist.
- All tests that write to the shared production database must use explicitly authorised test records and an approved cleanup plan. Prefer a separate staging Supabase project.

## 4. Target application architecture

### 4.1 Application data flow

1. User signs in through Supabase Auth.
2. Application resolves the user's active profile and school context from Supabase.
3. Screen loads its records from the appropriate relational table or approved RPC/Edge Function.
4. User changes are validated and submitted through the authorised persistence method.
5. The application confirms the database response and uses the returned saved row as the new UI state.
6. Uploads go to a private or appropriately scoped Storage bucket; the database stores the object path and safe metadata, not base64 image content.
7. On a new device, the same authorised user signs in and reads the same Supabase records.

### 4.2 Persistence API design

Extend `supabase-persistence.js` with narrow domain methods, not unrestricted UI-facing table writes. Each method must:
- require a valid authenticated user;
- derive and verify the active school context;
- accept only allow-listed fields;
- validate required fields and UUID references;
- use explicit school-scoped filters;
- rely on RLS and database constraints as final enforcement;
- return the database-saved row(s);
- surface errors instead of reporting success when no row was saved;
- never silently fall back to browser storage.

Privileged actions must call a verified Edge Function/RPC, not a generic `insert` or `update` helper.

## 5. Migration workstreams and order

| Workstream | Legacy source | Destination | Priority | Gate |
|---|---|---|---|---|
| A. School identity and academic context | `school:main`, `schoolInfo` | `schools`, `academic_sessions`, `terms` | First | Confirm Phase 4D migration history, secure update path and administrator decisions |
| B. Classes and class-arm configuration | `classArms` | `classes`; existing assignments and enrolments remain separate | First | Confirm exact class rows, UI dependencies and class write permissions |
| C. Form Master assignments | `formMasters` | `profiles`, `profile_roles`, `form_master_assignments` | High | Use secure account/assignment functions; reconcile assignment records; no password migration |
| D. Subject assignments | `subjectAssignments` | `teacher_assignments`, `profile_roles` | High | Verify staff identity, subject/class/session UUID mapping and role eligibility |
| E. Students and enrolments | `students_batch_*`, `students_meta` | `students`, `student_enrolments`, import workflow tables | High | Existing 743 student/enrolment rows are already in Supabase; no bulk copy. Read/write through approved import and enrolment workflows |
| F. Results and assessments | score arrays and assessment UI state | `results`, `assessment_configurations`, `form_master_student_assessments` | High | Current results table count was zero in the earlier baseline; map exact UI score lifecycle and authorisation before writes |
| G. Staff directory and profiles | `managementStaff`, `schoolStaff`, staff database | `school_staff_directory`, `profiles`, `profile_roles` | Medium | Staff Database already Supabase-backed; reconcile legacy arrays without duplicate import |
| H. Portal content | `portalNews`, `prefects`, `dutyRoster` | New school-scoped tables after schema design | Medium | Approve schema, retention, publication rules and RLS |
| I. Portal and ID-card configuration | `portalSettings`, `schoolIdCardSettings` | Dedicated school-scoped configuration tables | Medium | Separate operational settings from licensing, billing and privileged developer controls |
| J. Activity/audit history | `activityLog` | Append-only audit table or verified audit destination | Medium | Define actor, action, entity, timestamp, privacy and append-only access |
| K. Files and images | data URLs, local signatures and image fields | Supabase Storage + metadata | High | Create bucket/policies only after asset inventory, privacy, size, MIME and access design |
| L. User preferences | `keyboardStyle:*`, `scoreEntryDirection:*` | Optional `user_preferences` table or browser-only ephemeral preference | Low | Separate user preference from school business data |
| M. Developer/licensing state | `portal:developer` | Trusted developer identity and secure server-side licensing records | Separate security workstream | Never trust browser-global values or client-side licence grants |

## 6. Standard cutover checklist — required for every category

A category is not complete until all steps pass:

1. **Source inventory:** identify every load, save, update, delete and render path in `index.html` and supporting scripts.
2. **Destination review:** confirm existing table/columns, foreign keys, unique constraints, RLS policies, grants, triggers and RPC/Edge Function behaviour.
3. **Field mapping:** document every source field, destination field, transformation, null rule and unresolved field.
4. **Conflict report:** compare source and destination without writing. Identify source-only, destination-only, matching and conflicting records.
5. **Backup:** preserve source-device browser data and obtain a separate Supabase database backup before production writes.
6. **Implementation:** add a narrow persistence method and update every read/write path for that category.
7. **Failure handling:** show errors; never show a success toast until the Supabase write and read-back are confirmed.
8. **Read-back:** reload the saved record from Supabase and confirm it matches the intended change.
9. **Role tests:** test authorised administrator, relevant staff role, unauthorised role and cross-school denial where applicable.
10. **Device test:** sign in on a second browser/device and verify the same saved data appears.
11. **Cutover:** disable that category's legacy browser writes only after all checks pass.
12. **Documentation:** commit the operational/training manual, SQL/RPC notes and troubleshooting guide with the implementation.
13. **Rollback:** preserve a tested route to restore the prior frontend while keeping database changes safe and additive.

## 7. Supabase Storage design requirements

Before creating or changing buckets, inventory all asset sources and determine whether each asset is public or private.

Candidate buckets:
- `school-branding`: school logo and stamp; public logo only if approved, stamp private.
- `student-passports`: private; access through school-scoped authorisation or short-lived signed URLs.
- `staff-photos`: private by default; public display must use a deliberate publication workflow.
- `staff-signatures`: private; authorised assessment/administrative access only.
- `school-signatures`: private principal/headteacher signatures and official marks.

These are design candidates, not existing buckets. Verify actual Storage bucket inventory and policies before creating any. Prefer fewer buckets with clear, enforceable path policies if that is safer than unnecessary fragmentation.

Every upload path must validate:
- authenticated user and active school;
- permitted role and action;
- allowed MIME type and actual file signature where practical;
- maximum file size and image dimensions;
- generated object name (never trust a supplied path);
- school-scoped object path;
- overwrite rules and audit metadata;
- private/public access policy;
- safe deletion/replacement procedure.

Store object paths and metadata in the relational database. Do not store base64 images in `schools.logo_url`, staff rows or local JSON blobs.

## 8. Immediate implementation sequence

### Phase 5A — architecture and inventory
- [x] Inspect current `CloudStorage` implementation.
- [x] Inspect `saveAllData()` categories.
- [x] Inspect current Supabase persistence helper.
- [x] Confirm the Staff Database is a separate Supabase-backed path.
- [x] Document the target architecture and category sequence.
- [ ] Inventory every direct `CloudStorage` call by key/category and screen.
- [ ] Inspect current database migration history and Phase 4D deployment status before any schema deploy.

### Phase 5B — school identity and academic context
- Confirm the secure school profile update migration has not already been applied or reconcile its migration history.
- Confirm current RLS and grants.
- Implement a school-scoped read/update method with strict field allow-list.
- Replace only school identity form reads/writes after verification.
- Upload school logo/stamp assets through approved Storage paths, not data URLs.
- Read back, test on a second device and document.

### Phase 5C — class configuration
- Map class-arm display state separately from relational classes, assignments and student enrolments.
- Implement Supabase reads for class configuration.
- Route class changes through a secure, validated method.
- Do not overwrite or recreate the 30 existing class rows without reconciliation.
- Remove legacy class writes only after the class screen and all dependent screens pass tests.

### Phase 5D onward
Proceed through assignments, results/assessments, portal records, settings, audit history and files using the same checklist. Student data migration is not a bulk import task because the core 743 student and enrolment records already exist in Supabase.

## 9. Current phase status

This document records architecture and a safe work plan. It does not mean the application is already Supabase-only.

As of this review:
- legacy `CloudStorage` remains active;
- the generic persistence helper is incomplete for the application's full domain;
- Staff Database is the known completed Supabase-backed screen;
- school identity, class arms and most other categories still need implementation;
- no production database changes were made in Phase 5A;
- browser backup remains preserved and must not be deleted.

**Phase 5A completion condition:** architecture, category inventory and migration gates are documented. Phase 5B cannot proceed to production writes until the Phase 4D migration status and exact database permissions are confirmed.
