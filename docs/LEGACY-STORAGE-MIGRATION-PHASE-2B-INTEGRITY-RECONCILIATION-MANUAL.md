# Legacy Storage Migration — Phase 2B Integrity Reconciliation Manual

**System:** DE-GLOBAL ACADEMY GBOKO E-Result  
**School ID:** `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`  
**Phase:** 2B — Read-only data integrity reconciliation  
**Status:** Prepared; awaiting execution and review of SQL results  
**Audience:** School administrator, authorised database operator, migration support team

## 1. Purpose

This phase checks whether the existing Supabase student, enrolment and passport records are internally consistent before any legacy browser data is imported. It is a read-only audit. It does not repair, merge, archive, insert, update or delete records.

The baseline supplied by the school shows 743 student records, 743 enrolment records and 8 passport records. These figures are reference counts, not proof that every relationship is correct.

## 2. Roles and permissions

- **School administrator:** confirms the school identity and authorises any later remediation or test record.
- **Authorised database operator:** runs the supplied read-only SQL in Supabase SQL Editor and returns the result sets.
- **Migration support:** interprets the results, prepares conflict rules and proposes narrowly scoped changes for approval.
- **Other school users:** should not run migration scripts or attempt manual database repairs.

Do not share database passwords, service-role keys, student names, admission numbers or guardian contact details in audit responses.

## 3. Files

- [Phase 2B Integrity Reconciliation SQL](LEGACY-STORAGE-MIGRATION-PHASE-2B-INTEGRITY-RECONCILIATION.sql)
- [Phase 2 Baseline Audit SQL](LEGACY-STORAGE-MIGRATION-PHASE-2-BASELINE-AUDIT.sql)
- [Supabase Persistence Migration Map](SUPABASE-PERSISTENCE-MIGRATION-MAP.md)

## 4. How to run the audit

1. Open the Supabase project for DE-GLOBAL ACADEMY GBOKO.
2. Open **SQL Editor**.
3. Open the Phase 2B SQL file from the repository and copy its complete contents.
4. Paste the SQL into a new SQL Editor query.
5. Confirm that the school UUID in the script is exactly `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`.
6. Run the script.
7. Review the result tabs in the order labelled RESULT 1 through RESULT 9.
8. Return the result sets to the migration support conversation. If a result set is empty, explicitly report **0 rows**; do not omit it.

The script contains SELECT statements only. It must not be combined with unrelated SQL commands.

## 5. What each result means

| Result | Purpose | Expected interpretation |
|---|---|---|
| 1 | Confirms school identity and baseline totals | Must show the expected school. Counts should be compared with the baseline, not assumed to be unchanged if normal school activity has occurred. |
| 2 | Finds non-archived students without an active enrolment | Review student status and placement history. A row is not automatically an error. |
| 3 | Checks active enrolments for missing or cross-school student, class or session references | Any row requires investigation before migration. |
| 4 | Checks duplicate active enrolments for the same student and session | Normally zero rows because a unique partial index exists. |
| 5 | Checks active admission numbers that collide after trimming and case-folding | Any row needs a manual identity review. Admission numbers are not printed. |
| 6 | Checks passport ownership, updater profile and storage path | Any row needs review. This query does not verify that a file physically exists in Storage. |
| 7 | Checks student profile links | A student without a portal profile may be legitimate. Do not automatically provision accounts. |
| 8 | Counts active enrolments missing register numbers or SIDs | Investigate against the register and SID generation workflow. Do not invent or manually assign SIDs. |
| 9 | Summarises active enrolments by class and academic session | Use to compare class/session distribution with the school's official register. |

## 6. Validation rules

- A non-zero result is a review item, not automatic permission to change data.
- Do not delete duplicate-looking records. Confirm identity and enrolment history first.
- Do not merge students solely because their names look alike.
- Do not create a student login profile merely because `profile_id` is null.
- Do not generate or overwrite an SID outside the approved database generation workflow.
- Do not change archived enrolments to active without an authorised placement decision.
- Do not expose the private student-passport bucket or make it public.
- Preserve the school ID and all existing foreign-key relationships.
- Continue to use the existing student import and approval workflow for new student records.

## 7. Expected outcomes

The audit is ready for migration planning when:

1. The school identity is confirmed.
2. All non-empty integrity result sets have been classified as valid exceptions or actionable issues.
3. Duplicate and cross-school references have been resolved through an approved process, if any exist.
4. The student/enrolment totals have been reconciled with the official school register.
5. Passport paths have been checked separately against the private Storage bucket where required.
6. A dated audit report records the counts, findings, decisions and approving administrator.

An empty result set is a positive result for that specific check only. It does not prove that the legacy browser data is complete or that every other table is consistent.

## 8. Troubleshooting

- **Permission denied:** stop. Do not disable RLS or request a service-role key for browser use. Have an authorised database operator run the read-only audit.
- **Relation or column does not exist:** stop and report the exact error. Do not guess a replacement column or edit the query without checking the live schema.
- **School identity query returns no rows:** stop. Confirm the school UUID before running further migration steps.
- **Result set is truncated:** export the result from SQL Editor or return it in smaller sections. Do not treat a partial result as complete.
- **Storage object cannot be found:** retain the metadata row and investigate the private bucket/path separately. Do not delete the passport metadata automatically.

## 9. Practical training exercise

The database operator should demonstrate the following using the read-only script:

1. Locate the school identity result.
2. Explain the difference between a student record and an active enrolment.
3. Identify whether any active enrolment has a cross-school reference.
4. Explain why a missing student profile is not necessarily an error.
5. Explain why an SID must not be manually invented.
6. Return all nine result sets, including explicit zero-row results.

The trainer should verify that the trainee makes no database changes during this exercise.

## 10. Completion and next gate

**Phase 2B is not complete until the SQL has been run and all nine results have been reviewed.** This manual and the SQL file are prepared documentation; they do not represent a completed data reconciliation.

After review, the next phase is a legacy browser-data backup and export from the original device. The export must be preserved before any cutover. Then the legacy data can be compared against Supabase using stable identifiers and approved conflict rules.

No student, enrolment, passport, staff, result or configuration records are migrated by this phase. Do not clear browser storage, remove the legacy CloudStorage code, or perform bulk writes until the backup, reconciliation and acceptance checks are complete.
