# Supabase Persistence — Phase 7B Score and Assessment Read-Back Verification

**Date:** 9 November 2026  
**Scope:** Subject Teacher score batches, Form Master assessments, Administrator/Sub Administrator result batches and migration safety.

## 1. Purpose

A successful API response is not, by itself, sufficient evidence that every record can be retrieved from Supabase. This phase strengthens the three score and assessment workflows so the interface reports success only after a database read-back confirms the expected values.

This is a code and database verification phase. It does not claim that a real production result was entered during this audit. The live `results` and `form_master_student_assessments` tables contained zero rows at the time of inspection.

## 2. Subject Teacher score batches

The active Subject Teacher score-entry implementation reads the roster from `student_enrolments` and `students`, verifies the active teacher assignment, reads the term and assessment configuration from Supabase, and loads existing result rows from `results`.

After the teacher saves:

1. The application rechecks the active teacher assignment.
2. It validates every entered score against the configured component maximum.
3. It refuses to overwrite submitted, approved or published results through the draft-entry screen.
4. It upserts the draft batch using the database's unique key: `student_id, subject_id, academic_session_id, term_id`.
5. It requires the write response to return the expected number of rows.
6. It independently reads the exact student/class/subject/session/term result rows back from `results`.
7. It compares every assessment component, total, grade, remark and status against the intended payload.
8. Only after all comparisons pass does it display a success message and reload the score sheet.

If the write succeeds but read-back fails, the interface reports that verification failed and does not issue a success message. The user should inspect the rows before retrying to avoid duplicate or unintended changes.

## 3. Form Master assessment saves

The Form Master workflow verifies the authenticated active Form Master, the class assignment, the active enrolment and the official student record.

The assessment is stored in `form_master_student_assessments`, separately from subject scores. The upsert uses the unique key `school_id, student_id, academic_session_id, term_id`.

After saving, the application reads the row back under the Form Master's own RLS permissions and checks:

- Student, class, academic session and term IDs.
- Affective and psychomotor rating keys and values.
- Form Master comment.
- Attendance days and school days.
- Next-term fees.
- Assessor identity.

The success message is displayed only after the saved row and values match.

The table's `form_master_comment` column is NOT NULL. The Administrator/Sub Administrator batch RPC was corrected to store an empty string when the optional comment is blank, rather than attempting to insert SQL NULL.

## 4. Administrator and Sub Administrator batch saves

The privileged server workflow remains:

- Authenticated Edge Function: `save-admin-student-results`.
- Server-side RPC: `public.save_admin_student_result_batch`.

The RPC validates the active profile, role, Sub Administrator permission grants, class, school, session, term, active student enrolment, configured subject, score maxima and existing result status. It writes subject results and the accompanying Form Master assessment in one database transaction. The RPC is SECURITY DEFINER with a fixed search path; direct execution is not granted to `anon` or `authenticated`.

The client now requires the RPC to return the expected number of subject results and result IDs. It reads those exact IDs back through the authenticated client and verifies the student, class, session, term, draft status, total and grade. It also reads the accompanying Form Master assessment back and checks the ratings, comment, attendance, school days, fees and assessor before clearing the form.

## 5. Legacy passport migration safety

The one-time legacy passport migration now performs a complete preflight for embedded passport images:

- Every image must match an official student by admission number.
- Every official student must belong to the target school.
- If any official student already has a Supabase passport record, the entire legacy batch is retained for reconciliation.
- After preflight, the migration rechecks for an existing passport before saving.
- The metadata write uses INSERT, not UPSERT. A concurrent passport creation therefore cannot be silently overwritten.
- If a passport already exists at the final check, the newly uploaded object is removed and the legacy batch is retained.

This deliberately favours preservation over automatic conflict resolution.

## 6. Verification performed

The following checks were completed:

| Check | Result |
|---|---|
| Main application inline JavaScript syntax | Passed |
| `supabase-persistence.js` syntax | Passed |
| `score-entry-engine.js` syntax | Passed |
| `passport-registration.js` syntax | Passed |
| `script.js` syntax | Passed |
| Score engine accepts a score equal to its maximum | Passed |
| Score engine rejects a score above its maximum | Passed |
| Row-wise score navigation | Passed |
| Column-wise score navigation | Passed |
| Administrator RPC blank-comment handling | Corrected and verified |
| Result-table unique key used by Subject Teacher upsert | Confirmed |
| Form Master assessment unique key | Confirmed |
| Result and assessment row counts at audit time | 0 and 0 |

## 7. Legacy class-arm credential cleanup

A read-only comparison confirmed that all 30 `classArms` entries matched the 30 relational `classes` records by class name. The legacy array contained 30 obsolete generated `password` properties; the active application has no use for `arm.password` other than deleting it.

The obsolete properties were removed from the `classArms` JSON array in one guarded database update. The update preserved the array length and all non-password JSON fields, set the updater to the active Administrator profile, and performed an immediate read-back comparison against the expected transformed JSON. The verification query returned:

- Legacy class-arm records: 30.
- Relational class records: 30.
- Matching class names: 30.
- Remaining class-arm password properties: 0.

No class-arm records were deleted, and no relational class records were changed.

## 8. Live operational test still required

A live authenticated save and read-back has not yet been performed. The database currently contains no result or Form Master assessment rows, and this audit did not fabricate a student, assignment or assessment to create a test result.

For final acceptance, an authorised school operator should use a designated test student and active assignment/configuration, save a draft, reload the sheet, and confirm the exact values in Supabase. Then test the corresponding denied actions with an unauthorised role. Do not use a real learner's record for an artificial test.

## 9. Release rule

Do not declare the migration complete until the authenticated end-to-end test succeeds for Subject Teacher, Form Master and Administrator/Sub Administrator workflows. Keep legacy browser data until all unresolved keys and files are reconciled. No result, student, passport, signature or configuration record should be deleted merely to make counts appear consistent.
