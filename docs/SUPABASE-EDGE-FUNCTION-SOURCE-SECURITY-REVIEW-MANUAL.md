# Operational Review Manual — Recovered Edge Functions

## Purpose

This manual explains how to review the nine recovered Edge Function sources safely before any merge or production deployment. The recovery branch is a review copy; it is not a deployment branch.

## Roles

- **School Administrator:** may invoke only the account and staff operations authorised for their own school.
- **Portal Developer:** may perform the higher-level school-administrator provisioning operation.
- **Developer/reviewer:** inspects source, verifies database dependencies, runs tests in staging and records findings.
- **Production approver:** authorises any eventual merge or deployment separately.

Never share Supabase service-role keys, access tokens, database passwords, encryption-key values or student temporary passwords in source control, screenshots or chat.

## Recovered source files

The branch contains nine functions:
- change-form-master-password
- change-student-password
- create-form-master
- create-school-administrator
- create-subject-teacher
- manage-form-master
- provision-student-account
- reset-form-master-password
- reset-student-password

The corrected student-admission-login source remains separately on `main` and was intentionally excluded from this branch.

## Review procedure

1. Open the review branch in GitHub.
2. Inspect one function at a time; do not copy the review branch wholesale into `main`.
3. Confirm the caller's identity is validated from a Supabase Auth bearer session.
4. Confirm the caller's active profile and role are checked server-side.
5. Confirm every target record is constrained to the caller's school where the workflow is school-scoped.
6. Confirm privileged account operations use server-side secrets only.
7. Check all multi-step writes for rollback, idempotency and a documented reconciliation path.
8. Check CORS, rate limits, input validation and duplicate/concurrency handling.
9. Confirm database constraints, RLS policies, triggers and required secrets in a non-production environment.
10. Run static checks and staging tests before requesting production approval.

## Required negative tests

At minimum, test that:
- unauthenticated requests are rejected;
- expired/invalid bearer tokens are rejected;
- inactive callers are rejected;
- a School Administrator cannot operate on another school's records;
- students cannot invoke staff/admin operations;
- a student primary role cannot be converted into a Subject Teacher role;
- privileged non-staff roles cannot receive the Subject Teacher role;
- duplicate account and assignment requests do not create duplicate records;
- a failed multi-step operation leaves either a clean rollback or a clearly documented reconciliation state;
- password reset operations cannot be replayed to perform a second password change;
- temporary passwords are not written to logs or exposed to unauthorised users.

## Production safety rules

- Keep database deployment and Edge Function deployment disabled during source review.
- Do not alter live JWT verification settings as part of this review.
- Do not overwrite the corrected student-admission-login source with the recovered legacy copy.
- Do not run account creation or password reset tests against real student/staff accounts.
- Use a staging Supabase project and synthetic accounts for runtime testing.
- Before any live deployment, back up the database, reconcile migration history, verify secrets and obtain explicit approval.
- Record the exact commit SHA, test evidence, reviewer and approver in the deployment record.

## Review result

The static review and its findings are recorded in `SUPABASE-EDGE-FUNCTION-SOURCE-SECURITY-REVIEW.md`. The functions are not yet approved for production deployment.