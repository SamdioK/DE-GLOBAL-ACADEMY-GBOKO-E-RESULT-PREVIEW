# Edge Function Source Security Review — Recovered Branch

**Project:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Review branch:** `recovered-edge-functions-20261107`  
**Review date:** 7 November 2026  
**Scope:** Static review of nine recovered deployed Edge Function source files. The corrected `student-admission-login` source on `main` was intentionally excluded from this recovery branch and is outside this nine-function review.

## Executive outcome

**Status: Review completed at static-source level; changes are not approved for deployment.**

The recovered source is useful and contains several sound safeguards: authenticated-user verification, school ownership checks in important workflows, temporary passwords generated server-side, first-login password-change flags, and an operation-state mechanism for student password resets.

However, the review identified issues that should be addressed or explicitly accepted before deployment. No database writes, function deployments, JWT setting changes, or production configuration changes were made during this review. The existing live functions remain unchanged.

## Files reviewed

1. `change-form-master-password/index.ts`
2. `change-student-password/index.ts`
3. `create-form-master/index.ts`
4. `create-school-administrator/index.ts`
5. `create-subject-teacher/index.ts`
6. `manage-form-master/index.ts`
7. `provision-student-account/index.ts`
8. `reset-form-master-password/index.ts`
9. `reset-student-password/index.ts`

## Findings and required actions

### High priority

#### 1. Subject Teacher role assignment needs an allow-list of eligible staff roles

**File:** `create-subject-teacher/index.ts`

The existing-profile path rejects inactive profiles and profiles whose primary role is `student`, but it does not explicitly reject other privileged or non-staff roles. A non-student profile could therefore be considered for Subject Teacher assignment unless another database constraint prevents it.

**Required correction:** define and enforce the permitted primary roles for staff who may receive the additional `subject_teacher` role. Explicitly reject `portal_developer`, `administrator`, and any other non-staff roles. Verify that the profile belongs to the same school and that its staff-directory record is valid before granting the additional role. Preserve the intended multi-role design for legitimate staff, such as a Form Master who is also a Subject Teacher.

#### 2. Multi-step account creation needs stronger transactional guarantees

**Files:** `create-form-master/index.ts`, `create-school-administrator/index.ts`, `create-subject-teacher/index.ts`, `provision-student-account/index.ts`

These functions create or modify multiple related records across Supabase Auth and application tables. They use compensating cleanup in some failure paths, but the Auth and database operations are not one atomic transaction. Cleanup failures can leave partial state requiring manual reconciliation.

**Required correction:** use a database RPC/transaction for related database mutations where practical; retain explicit Auth cleanup and verify cleanup outcomes. Add a documented reconciliation path for partial failures. Do not blindly retry account creation after an uncertain Auth result.

### Medium priority

#### 3. No function-level throttling is evident in the reviewed source

**Files:** all nine reviewed functions, particularly login-adjacent password-change, reset, and account-provisioning operations.

The source does not show explicit per-user or per-IP rate limiting. Gateway/Auth protections may exist independently, but they were not verified as part of this source review.

**Required action:** confirm the deployed gateway and Auth rate limits, and add application-level throttling or abuse controls for sensitive account and password operations where appropriate. Do not treat CORS as a substitute for authentication or rate limiting.

#### 4. CORS is permissive in several functions

**Files:** `change-form-master-password`, `change-student-password`, `create-form-master`, `reset-form-master-password`, `provision-student-account`; other functions use the `withSupabase` wrapper and do not all define the same CORS policy.

Several handlers return `Access-Control-Allow-Origin: *`. This does not by itself bypass bearer-token authentication, but it allows browser requests from any origin.

**Required action:** standardise CORS handling and allow only the school application origins that are actually required (including the production GitHub Pages origin and any deliberately supported preview origin). Keep server-side authentication and authorisation checks regardless.

#### 5. Password reset and password-change flows need consistent policy and session handling

**Files:** `change-form-master-password`, `change-student-password`, `reset-form-master-password`, `reset-student-password`.

The student first-login change function enforces 12–128 characters with upper/lowercase, number and symbol. The Form Master change/reset and School Administrator creation paths use different minimum rules. This may be intentional, but the policy is inconsistent and should be documented and aligned with school policy.

The Form Master change function validates the caller's bearer session, then changes that same user's password through the service-role admin client. This is server-side and does not expose the service-role key, but it should be tested for session revocation/reauthentication behaviour and clear client sign-out handling.

**Required action:** define one documented password policy by account type, verify session invalidation and re-login behaviour, and test first-login flag transitions. Never return or log passwords except the one-time temporary credential response required by the authorised admin workflow.

#### 6. Dependency versions are not consistently pinned

**Files:** functions importing `npm:@supabase/server@^1` and `https://esm.sh/@supabase/supabase-js@2`.

Range imports can resolve to newer compatible versions over time, and the imports use more than one packaging approach.

**Required action:** standardise on a tested Supabase client/runtime import strategy and pin exact versions. Run Deno checks and function tests before deployment.

#### 7. Account provisioning needs additional duplicate and concurrency tests

**Files:** `create-form-master`, `create-subject-teacher`, `provision-student-account`.

Some functions check for duplicate assignments or usernames before inserting. A pre-check alone is subject to concurrent requests; database unique constraints are the final protection. Student provisioning includes a conditional pending-state claim, which is a useful safeguard.

**Required action:** verify relevant unique constraints exist and test simultaneous duplicate requests. For Form Master assignment, verify the database enforces the intended one-assignment-per-school/class/session rule.

### Positive controls observed

- Most functions verify the authenticated caller and check the caller's active profile/role before privileged operations.
- The Form Master, Subject Teacher and student provisioning flows perform important same-school checks.
- Student provisioning reserves the student record with a conditional status update before creating the Auth account.
- Student password reset uses a client-supplied operation ID, stores an encrypted temporary credential, tracks operation states, and avoids blindly repeating uncertain Auth updates.
- The student reset flow verifies the current academic session, current enrolment, class ownership and linked student profile before proceeding.
- The recovered source does not intentionally return the service-role key to the browser.
- Password reset encryption uses the server-side `STUDENT_RESET_ENCRYPTION_KEY_V1` secret. The secret's value was not accessed. Its configured value and 32-byte Base64 validity remain unverified.

## Function-by-function summary

| Function | Static review summary |
|---|---|
| change-form-master-password | Authenticated self-service Form Master password change; verify session lifecycle and align password policy. |
| change-student-password | Strong first-login checks, active student/profile linkage and password complexity; test sign-out/re-login and failed flag update handling. |
| create-form-master | Checks active same-school administrator, school, class, session, duplicate assignment and username; strengthen transactional cleanup and concurrency tests. |
| create-school-administrator | Restricts caller to active Portal Developer and checks target school/username; strengthen input validation, password policy, and partial-creation reconciliation. |
| create-subject-teacher | Supports existing staff multi-role assignment and new account creation; restrict eligible existing primary roles to an explicit staff allow-list. |
| manage-form-master | Checks active same-school administrator and validates assignment, current session, class and Form Master profile; updates profile/Auth/assignment with compensating rollback. Test all rollback branches. |
| provision-student-account | Checks active same-school administrator, active student, admission number, enrolment and conditional pending claim; verify rollback and concurrency behaviour. |
| reset-form-master-password | Checks active same-school administrator, active Form Master and assignment; returns a temporary password once; align policy and test partial failure recovery. |
| reset-student-password | Strongest operation-state and school/enrolment validation flow; validate encryption secret configuration, operation table constraints/RLS, and all recovery states in staging. |

## Verification limits

This is a static source review, not a penetration test or runtime certification.

The following were not performed:
- Deno type-check or dependency resolution.
- Automated unit, integration, concurrency or browser tests.
- Live invocation of any Edge Function.
- Verification of every deployed environment secret value.
- Verification of all database constraints, triggers, grants and RLS policies used by these functions.
- Verification of deployed source against every recovered file beyond the successful source download process.
- Production deployment.

## Deployment decision

**Do not deploy the recovered branch as-is.**

Next steps, in order:

1. Correct the Subject Teacher eligible-role allow-list.
2. Review and improve partial-failure cleanup and reconciliation for multi-step account creation.
3. Confirm rate limits, CORS origins, environment secrets, database constraints and RLS dependencies.
4. Pin dependencies and run Deno checks.
5. Test all nine functions in a staging project with test accounts and negative authorisation cases.
6. Obtain explicit approval before merging or deploying to the live Supabase project.

The recovery branch is a review copy only. It must not replace the corrected `student-admission-login` source on `main`.
