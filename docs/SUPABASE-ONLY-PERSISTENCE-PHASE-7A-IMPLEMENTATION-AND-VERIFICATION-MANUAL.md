# Supabase-Only Persistence — Phase 7A Implementation and Verification Manual

**Date:** 9 November 2026  
**Scope:** E-Result application persistence, legacy-data migration safeguards, score-entry persistence and Storage verification.

## 1. Purpose and completion boundary

This phase closes the false-success path in which the application could report a save even when data existed only in browser storage. It establishes Supabase Database and Supabase Storage as the active persistence destinations and protects old browser data during migration.

This is an implementation and verification record, not a declaration that every legacy record has been reconciled or that a live score submission has been end-to-end tested. Do not clear the original browser profile or its backup on the strength of this phase alone.

## 2. Active persistence paths

### 2.1 School application state

The active `CloudStorage` adapter in `index.html` now:

1. Requires an authenticated Supabase user and an active school profile.
2. Verifies that the requested school matches the authenticated profile's `school_id`.
3. Restricts writes to authorised Administrator and Portal Developer roles.
4. Reads and writes school-scoped JSON state through `public.school_app_state`.
5. Throws on failed writes; it has no localStorage, IndexedDB or device-storage fallback.
6. Uses `public.portal_global_state` only for the authorised Portal Developer profile.

The school-state table has Row Level Security enabled and forced. Staff reads are restricted by role and key; write operations are limited to the authorised school roles.

### 2.2 Relational records and files

Operational records use their Supabase tables and controlled workflows, including:

- Students and enrolments: `students` and `student_enrolments`.
- Classes and assignments: `classes`, `teacher_assignments` and `form_master_assignments`.
- Subject results: `results`.
- Form Master assessments: `form_master_student_assessments`.
- Score-entry preferences: `score_entry_preferences`.
- Staff directory: `school_staff_directory`.
- School portal settings, news, duty roster, ID-card settings and staff selections: their dedicated school-scoped tables where the relational adapter is used.
- Uploaded assets: Supabase Storage, with metadata and object paths in database records.

Student passport files use the private `student-passports` bucket. Private school assets and teacher signatures use `school-private-assets`; public school images use `school-public-assets`.

### 2.3 Score-entry persistence

Keyboard style and entry direction are stored in `score_entry_preferences`, not in browser storage. The inspected live preference row is `smart` keyboard style with column-wise entry.

Subject-teacher score submission writes to `results` under assignment and RLS checks. Administrator/Sub Administrator batch submission uses the authenticated `save-admin-student-results` Edge Function and the server-only `save_admin_student_result_batch` RPC. The RPC is SECURITY DEFINER but is not executable by `anon` or `authenticated`; the service role is the only application execution grant.

## 3. Legacy migration safety rules

The one-time migration bridge is allowed to read recognised legacy keys from localStorage, IndexedDB and the optional host storage interface. These reads are migration-only; normal application reads and writes use Supabase.

The current safeguards are:

1. Existing destination keys are checked before image conversion. A conflicting legacy source is retained and is not transformed into duplicate Storage uploads.
2. A new school-state row must be inserted successfully and confirmed by a Supabase read-back before its source key is removed.
3. An existing destination is not assumed to contain the same or newer data. It is left for explicit reconciliation; the legacy source is retained.
4. Student passport batches are preflighted before uploads. If an official student cannot be matched or an existing passport record is found, the batch is left intact for review rather than replacing a cloud passport.
5. If a teacher-signature destination already exists, the legacy signature source is retained because equivalence has not been proven.
6. Password properties are removed from legacy Form Master and subject-assignment objects before they are saved. New class-arm objects no longer generate predictable password values. The load-time cleanup also removes the obsolete class-arm password property and saves the cleaned state through Supabase.

Do not manually delete a source, destination row or Storage object to force a migration through. Reconcile by stable IDs and verify the stored result first.

## 4. Live verification snapshot

The following read-only checks were completed against the connected Supabase project on 9 November 2026:

| Item | Observed state |
|---|---:|
| Classes | 30 |
| Students | 743 |
| Active enrolments | 743 |
| Teacher assignments | 1 |
| Form Master assignments | 17 |
| Staff-directory records | 15 |
| School application-state keys | 15 |
| Teacher-signature metadata records | 2 |
| Student-passport metadata records | 8 |
| Private school asset objects | 10 |
| Public school asset objects | 1 |
| Student-passport objects | 8 |
| Score-entry preference rows | 1 |
| Result rows | 0 |
| Form Master assessment rows | 0 |

The inspected school-state values contained no embedded `data:image` payloads. The 30 existing class-arm objects still contain a legacy `password` property in the live JSON row at the time of this audit; the current application code now strips that obsolete generated property during the next authorised Administrator load/save. A verified backup and the impact on any older deployment sharing this project must be considered before any direct database cleanup.

RLS is enabled on all inspected persistence tables. It is forced on `school_app_state`, `score_entry_preferences`, `school_portal_news`, `school_duty_roster`, `school_portal_staff_selections` and `school_id_card_settings`. The inspected Storage object policies are bucket- and school-scoped.

The five active JavaScript files were syntax-compiled successfully: the inline application script in `index.html`, `supabase-persistence.js`, `score-entry-engine.js`, `passport-registration.js` and `script.js`.

## 5. Administrator verification procedure

1. Sign in using an authorised Administrator account.
2. Allow the school data loader to read the current school state from Supabase.
3. Confirm the official class, student, enrolment and assignment counts against the administration records.
4. Confirm that school branding and teacher signatures render from their Storage paths.
5. Change the score-entry keyboard style or direction and reload the score-entry screen. Confirm that the preference is restored from Supabase.
6. Enter a controlled score only when an authorised test student, active assignment, session, term and assessment configuration are available. Save, reload, and verify the exact row in `results`; do not use invented student IDs or production learner records for a test.
7. Confirm that an unauthorised role cannot write school-wide state or another teacher's score.
8. Review migration conflicts. Do not clear any remaining browser source until the matching Supabase record and any associated Storage object have been verified.

## 6. Outstanding gates

- A live authenticated score submission and read-back has not been performed. The inspected `results` and `form_master_student_assessments` tables currently contain no rows, so no real result-save test can be claimed.
- The existing browser backup is not exhaustive: the optional host storage interface may not enumerate all keys. Preserve the original device/browser data until the remaining sources are inspected.
- The 30 legacy class-arm password properties remain in the database until the authorised application cleanup runs. Do not directly scrub the shared database without a verified backup and confirmation that no older deployment depends on those fields.
- Some school-owned configuration remains in the generic `school_app_state` JSON table. It is still Supabase Database persistence; further normalisation into dedicated tables should be performed category by category, with read-back and role tests.
- The obsolete first-time `school:main` setup path is not part of the active school-profile workflow and must be retired or replaced with the authorised server-side provisioning process before it is relied upon.
- The GitHub JavaScript validation workflow is configured to run on pushes to `main`. A completed hosted workflow result was not available during this verification; the local syntax compilation above passed.

## 7. Release rule

The migration is not complete merely because the code has been committed or a row exists. A domain is complete only after its normal read and write paths use Supabase, files are in Storage, RLS and Storage access have been tested for allowed and denied roles, and the source has been reconciled without loss. Keep unresolved domains marked **Pending verification**.
