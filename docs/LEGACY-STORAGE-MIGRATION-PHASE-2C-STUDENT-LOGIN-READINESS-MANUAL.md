# Phase 2C — Student Login Readiness Audit Manual

**System:** DE-GLOBAL ACADEMY GBOKO E-Result  
**School UUID:** `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`  
**Phase:** 2C — Read-only student account readiness  
**Status:** Prepared; awaiting SQL execution and review

## 1. Purpose

The Phase 2B integrity audit found 742 student rows with a null `profile_id`. This phase determines how those rows are distributed by student status, login status and admission-number readiness. It also checks the linked profile role and whether any one profile is linked to multiple student rows.

A student academic record and a student portal account are separate concepts. A null `profile_id` does not by itself prove data corruption or a failed migration.

## 2. What the current application code establishes

The inspected frontend code shows:

- Student admission login calls the `student-admission-login` Supabase Edge Function.
- After authentication, the frontend requires an active `profiles` row with role `student`.
- The authenticated profile must link back to a student row through `students.profile_id`, in the same school, with a matching admission number.
- The administrator Student Database interface offers a separate **Create Login** action for eligible active students with an official enrolment and a usable admission number.
- Account provisioning calls the `provision-student-account` Edge Function.
- The interface recognises existing, pending and created account states and cautions against retrying an uncertain provisioning operation.

Therefore, a student with no profile link cannot complete the normal student portal login flow until an authorised account-provisioning workflow creates and links the account. This does not mean every student must have an account.

The Edge Function implementation and its live configuration must still be reviewed before any provisioning batch is considered.

## 3. Roles and permissions

- **School administrator:** decides which students should receive portal accounts and initiates the approved individual provisioning workflow.
- **Authorised database operator:** runs the read-only audit and returns aggregate results.
- **Migration support:** reviews counts and verifies the provisioning workflow and safeguards.
- **Students:** receive credentials privately and must change temporary passwords at first login.

Do not create student accounts by inserting directly into `profiles`, linking `profile_id` manually, or writing passwords into the database from browser code.

## 4. How to run

1. Open Supabase SQL Editor for the academy project.
2. Open [Phase 2C Student Login Readiness Audit SQL](LEGACY-STORAGE-MIGRATION-PHASE-2C-STUDENT-LOGIN-READINESS-AUDIT.sql).
3. Copy the complete SQL into a new query.
4. Verify the school UUID in the comments and WHERE clauses.
5. Run the query.
6. Return all four result sets, including explicit zero-row results.

The script contains SELECT statements only. It does not provision accounts, update login status, or change student records.

## 5. Result interpretation

| Result | What it shows | What to check |
|---|---|---|
| 1 | Counts by student status, login status and profile-link state | Identify which groups lack accounts and whether their login status is consistent. |
| 2 | Counts by student status, admission-number state and profile-link state | Identify active records with missing or placeholder admission numbers. |
| 3 | Role, active state and password-change requirement for linked profiles | Linked student profiles should have the expected student role and active state. |
| 4 | Profiles linked to more than one student row | Normally zero rows; any row requires investigation. |

## 6. Safety rules

- Do not automatically provision all 742 unlinked student records.
- First obtain the school's decision on which students require portal access.
- Use the administrator's existing **Create Login** interface and the server-side provisioning Edge Function, not direct SQL inserts.
- Never generate passwords in a spreadsheet or store them in legacy browser storage.
- Share temporary credentials privately and require password change at first login.
- If provisioning times out or returns an uncertain result, refresh and inspect the student account status before retrying.
- Do not change the existing 743 student rows or enrolments as part of this audit.

## 7. Completion gate

Phase 2C is complete after all four result sets have been reviewed and the school has documented whether student portal accounts are required for all active students or only selected groups.

Only after this decision and verification of the server-side provisioning function should any account creation campaign be planned. Account provisioning is a separate controlled operation from legacy data migration.


## 8. School account policy and actual audit results (2026-11-07)

The school confirmed the operating policy: **student login accounts are created by the administrator, and the login details are given to the respective students.** The audit must not be interpreted as an instruction to create accounts for every student automatically.

The four result sets returned the following:

| Audit measure | Result |
|---|---:|
| Active students | 743 |
| Active students with login status `created` and a linked profile | 1 |
| Active students with login status `not_created` and no profile link | 742 |
| Active students with a nonblank admission number | 743 |
| Linked profiles with role `student` | 1 |
| Linked profiles active | 1 |
| Linked profiles with `must_change_password = true` | 0 |
| Profiles linked to multiple student rows | 0 |

The duplicate-profile query returned **Success — no rows returned**. This means no profile was found linked to multiple student records.

### Interpretation

- The 742 active students without profile links are awaiting administrator-created accounts. They are not automatically data-integrity failures.
- All 743 active students have nonblank admission numbers in this audit.
- The single existing linked profile has the expected `student` role and is active.
- The existing linked profile currently has `must_change_password = false`; this is an observed state, not a reason to alter the account during this audit.
- No account creation, password reset, profile linking or student-record update was performed.

### Administrator account-creation procedure

When a student is authorised to receive portal access:

1. The administrator locates the correct active student record.
2. The administrator confirms the admission number and official enrolment.
3. The administrator uses the application's existing **Create Login** action.
4. The server-side `provision-student-account` workflow creates and links the account.
5. The administrator verifies the resulting login status before communicating credentials.
6. Login details are handed to the student privately. Temporary credentials must not be posted publicly or stored in spreadsheets.
7. Where the account is configured to require a password change, the student changes the temporary password at first login.
8. If provisioning has an uncertain outcome, the administrator checks the account status before attempting another creation.

Do not insert profiles directly, manually set `students.profile_id`, or provision all 742 students as a migration shortcut. The server-side Edge Function implementation and live configuration still require review before any wider account-creation exercise.

### Phase 2C completion status

**Audit execution and result review: complete.** The school policy is documented. Account provisioning remains an administrator-controlled operational activity and is separate from legacy data migration. Phase 2C made no database changes.

The next migration activity is to prepare a protected backup/export of legacy browser data from the original device. Do not clear browser storage or begin bulk migration until the export is preserved and its contents are reviewed.
