# Operational Manual — Supabase Edge Function Recovery and Initial Review

## Purpose
This section explains how the school technical administrator recovers the currently deployed Edge Function source and reviews it without changing production.

## Roles and access
- Repository owner: initiates the GitHub Actions workflow and downloads the artifact.
- Supabase project administrator: verifies function settings and runtime secret names in the Supabase dashboard.
- Developer/reviewer: inspects the source, documents findings and prepares tested changes.
- Do not share Supabase access tokens, database passwords, service-role keys or encryption-key values.

## Recovery workflow
1. Open the repository's Actions tab.
2. Select **Supabase deployment (manual)**.
3. Run on `main`.
4. Set **Deploy database = no**.
5. Set **Deploy Edge Functions = no**.
6. Set **Download existing Edge Functions = yes**.
7. If production approval is requested, review and approve the recovery run.
8. Confirm the connection-check and download-functions jobs pass.
9. Download the `deployed-edge-functions-source` artifact from the run's Artifacts section.
10. Keep the ZIP as a protected recovery snapshot. The workflow artifact has a three-day retention period.

## Validation and expected outcome
The successful recovery run should list and download ten functions. The database and deployment jobs should be skipped. This confirms source retrieval only; it does not prove that the source is locally type-checked or that runtime settings and secrets have been recovered.

## Security review checks
- Confirm callers are authenticated and their active role is checked.
- Confirm school-owned records are queried and changed with the caller's school ID.
- Confirm password changes are limited to the authenticated account or an authorised same-school administrator.
- Inspect login endpoints for generic error messages, abuse controls and accurate first-login status.
- Verify runtime secret names without exposing values.
- Record each finding and test result before preparing a deployment.

## Troubleshooting
- **Connection check fails:** inspect the job log for missing GitHub secrets or Supabase token permissions. Never paste a token into a log or chat.
- **Function listing fails:** confirm the token has project access and project read permission.
- **Download fails:** check the Supabase CLI log and project reference.
- **Artifact is unavailable:** rerun the recovery workflow; do not deploy functions as a workaround.
- **A runtime secret is missing:** configure it in Supabase Function Secrets. Do not put the value in GitHub source files.

## Training exercise
Have a trainee recover the ten functions with both deployment inputs set to `no`, download the artifact, identify each function's purpose, and produce a findings list. The trainee must demonstrate that no production function or database object was changed.

## Completion criteria
- Ten deployed function sources recovered.
- Artifact retained outside the short-lived Actions retention window.
- Initial review findings documented.
- No production database or function deployment performed.
- Runtime settings and secrets marked verified or outstanding.
