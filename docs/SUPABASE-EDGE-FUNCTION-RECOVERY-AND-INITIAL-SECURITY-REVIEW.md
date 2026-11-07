# Supabase Edge Functions — Recovery and Initial Security Review

**Project:** DE-GLOBAL ACADEMY GBOKO  
**Supabase project reference:** rvmcqvfuioxmbtvgdptb  
**Review date:** 7 November 2026  
**Source basis:** Deployed function source downloaded from the linked Supabase project using the Supabase CLI in GitHub Actions run #3. Ten functions were recovered. This review describes the recovered source, not an independent penetration test or live runtime verification.

## 1. Recovery result

All ten deployed functions were listed and downloaded successfully:

- `change-form-master-password`
- `create-form-master`
- `change-student-password`
- `create-school-administrator`
- `create-subject-teacher`
- `provision-student-account`
- `manage-form-master`
- `reset-form-master-password`
- `reset-student-password`
- `student-admission-login`

The workflow uploaded the source as the GitHub Actions artifact `deployed-edge-functions-source`. Database and Edge Function deployment jobs were skipped. No deployed function was changed by this recovery.

The CLI download contained each function's `index.ts`; it did not establish the deployed gateway JWT settings, runtime secret values, or other deployment configuration. The recovered source must therefore not be treated as a complete deployable project until those items are verified.

## 2. Positive controls observed in source

- Administrative provisioning functions authenticate the caller and check an active administrator or portal-developer profile before using the service-role client.
- Student provisioning scopes the student lookup and update to the caller's school and uses a conditional claim before creating an Auth account.
- Form Master creation and management check school ownership and active account status.
- Student and Form Master password-change handlers verify the authenticated user and role before updating the password.
- Student password reset checks the administrator, student, school, enrolment/class relationships and reset-operation records.
- The source scan found no obvious hard-coded service-role key, access token or other long secret literal. This is a heuristic scan, not proof that all sensitive data is absent.

## 3. Findings requiring resolution before deployment

### F-01 — Student admission login response hard-codes first-login status
**Function:** `student-admission-login`

The function selects the linked student and profile, but its profile query does not select `must_change_password`; the response always returns `must_change_password: true`. This can misrepresent the actual profile state and may force a first-login flow even after the flag has been cleared. The handler should return the verified profile value and also confirm the student's login status is `created`.

**Priority:** High for login-flow correctness.  
**Action:** Correct and test before redeploying this function.

### F-02 — Student admission login has no function-level throttling visible in source
**Function:** `student-admission-login`

The function accepts admission number and password and calls password sign-in, but the recovered source contains no explicit per-IP, per-admission-number, or other function-level attempt throttling. Supabase Auth may apply its own controls; that does not establish a suitable rate limit for this wrapper.

**Priority:** High security review item.  
**Action:** Verify applicable Auth rate limits and add an abuse-control design before exposing this endpoint broadly. Do not log passwords or return account-existence details.

### F-03 — Student lookup is not explicitly school-qualified
**Function:** `student-admission-login`

The initial student lookup filters by admission number only. The present project is a single-school deployment, but the schema uses `school_id` and the admission-number uniqueness rule is school-scoped. A future multi-school deployment could encounter ambiguous admission numbers.

**Priority:** Medium; architecture safeguard.  
**Action:** Add an explicit school identifier or a controlled school-resolution mechanism if multiple schools will share this project.

### F-04 — Password reset depends on an external runtime encryption secret
**Function:** `reset-student-password`

The handler requires `STUDENT_RESET_ENCRYPTION_KEY_V1`, which must decode from Base64 to exactly 32 bytes for AES-GCM. The recovered source does not reveal whether this secret is currently configured in Supabase. Losing or rotating it without a versioned migration plan could make stored reset-operation ciphertext unreadable.

**Priority:** High operational dependency.  
**Action:** Verify the secret's presence by name only in Supabase Function Secrets. Never print, download, or commit its value. Confirm key backup and rotation/recovery arrangements before relying on this reset workflow.

### F-05 — Function deployment configuration was not recovered
**Functions:** All ten

The downloaded artifact contains TypeScript source only. It does not establish each function's deployed `verify_jwt` setting, import map, runtime settings, or secret configuration. In particular, `student-admission-login` is a credential-entry endpoint and its gateway JWT setting must be verified against the currently working login flow before any redeployment.

**Priority:** High deployment safety.  
**Action:** Recover or document current per-function settings before creating `supabase/config.toml` or deploying any function.

### F-06 — Dependency versions are not consistently pinned
**Functions:** Source using `https://esm.sh/@supabase/supabase-js@2` or `npm:@supabase/server@^1`

The recovered source uses major-version or semver-range imports rather than a single exact dependency lock. A future redeployment could resolve a newer compatible package version.

**Priority:** Medium.  
**Action:** Pin and test dependency versions when preparing the source-controlled release; do not change imports in the recovery baseline.

## 4. Deployment and secret status

- GitHub Actions authentication to the expected Supabase project: passed.
- Existing function listing and source download: passed.
- Function deployment: not run.
- Database migration deployment: not run.
- `STUDENT_RESET_ENCRYPTION_KEY_V1`: presence not yet verified.
- Supabase function gateway settings: not yet verified.
- Deno type-check: not run in this environment; Deno was not installed in the review container.

## 5. Required next steps

1. Preserve the downloaded archive as the recovery snapshot. Its GitHub Actions artifact expires after three days.
2. Verify runtime secret names and function gateway settings in Supabase without revealing secret values.
3. Correct F-01 and design the rate-limit safeguard for F-02 in a reviewed change, not directly in the live project.
4. Establish a deployable Supabase CLI project and compare its configuration with the live project.
5. Add source-controlled migrations only after reconciling migration history and confirming whether Phase 4D has been manually applied.
6. Run local/static checks and a controlled test plan before any production deployment.

## 6. Safety decision

**No production deployment is authorised by this review.** Keep both deployment inputs set to `no` until the findings and deployment configuration above are resolved. Do not delete browser storage or alter existing student, staff, class, result or enrolment records as part of this source-recovery phase.

## 7. Live gateway JWT configuration verification — 7 November 2026

The project administrator inspected the Supabase Dashboard setting **Verify JWT with legacy secret** for all ten recovered functions and confirmed that all settings match the expected configuration:

| Function | Expected | Administrator-confirmed live setting |
|---|---|---|
| `student-admission-login` | OFF | OFF |
| `provision-student-account` | ON | ON |
| `change-student-password` | ON | ON |
| `reset-student-password` | ON | ON |
| `create-form-master` | ON | ON |
| `manage-form-master` | ON | ON |
| `change-form-master-password` | ON | ON |
| `reset-form-master-password` | ON | ON |
| `create-school-administrator` | ON | ON |
| `create-subject-teacher` | ON | ON |

No gateway setting was changed. This confirmation records the administrator's dashboard inspection; it is not an independent API export of function configuration.

The custom secret name `STUDENT_RESET_ENCRYPTION_KEY_V1` was also confirmed visible in Supabase Edge Function Secrets. Its value and cryptographic validity have not been inspected and must remain confidential.

## 8. Corrected student admission login source prepared — not deployed

A reviewed source correction has been committed at `supabase/functions/student-admission-login/index.ts` (commit `cfc52005b531d3c13f3664ef96da06dd6f46032f`). The Supabase CLI config explicitly preserves `verify_jwt = false` for this pre-authentication credential-entry endpoint (commit `0333123b3bf59c34f15b2e9406f61fc03870b41c`).

The corrected source:
- selects and requires `students.login_status = 'created'`;
- selects `profiles.must_change_password`;
- returns the actual profile flag instead of always returning true;
- requires a successful Auth session before returning tokens;
- retains generic credential failure responses.

This is a source-only change. It has not been deployed or runtime-tested. The function uses a service-role client to look up the student/profile and a public client to authenticate the password. The admission-number lookup is still not explicitly constrained by a caller-supplied school identifier, and function-level throttling has not yet been implemented. These remain open review items.

**Do not deploy Edge Functions yet.** Only the student admission login source has been added to the repository so far; the other nine recovered source files and their deployment configuration have not yet been committed. A deployment run at this stage would not constitute a complete source-controlled baseline.
