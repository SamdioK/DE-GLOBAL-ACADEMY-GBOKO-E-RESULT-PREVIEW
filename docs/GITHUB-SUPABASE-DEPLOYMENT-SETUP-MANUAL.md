# GitHub–Supabase deployment setup
## Purpose
This repository now has a manual GitHub Actions deployment path for the DE-GLOBAL ACADEMY GBOKO Supabase project. GitHub Pages continues to host the browser application; GitHub Actions deploys versioned SQL migrations and Edge Function source to Supabase.

## Production target
- Project ref: `rvmcqvfuioxmbtvgdptb`
- Project URL: `https://rvmcqvfuioxmbtvgdptb.supabase.co`
- Workflow: `.github/workflows/supabase-deploy.yml`

## Required GitHub Actions secrets
In GitHub, open the repository → Settings → Secrets and variables → Actions → New repository secret. Add:
1. `SUPABASE_ACCESS_TOKEN` — a Supabase personal access token with access to this project.
2. `SUPABASE_DB_PASSWORD` — the database password for this Supabase project.
3. `SUPABASE_PROJECT_REF` — set to `rvmcqvfuioxmbtvgdptb`.

Never paste these values into chat, commit them to Git, or place them in browser JavaScript. The project reference is not itself a password, but the workflow reads it as a secret for consistent configuration.

## Protect production
Create a GitHub Environment named `production` under Settings → Environments. Configure required reviewers before running a deployment. The workflow is manual-trigger only and defaults both deployment choices to `no` for database changes and `yes` for Edge Functions. A job will only run after its corresponding choice is deliberately selected. Environment approval is an additional safeguard; configure it before running the workflow.

## Run the workflow
1. Open the repository's Actions tab.
2. Select **Supabase deployment (manual)**.
3. Select **Run workflow** on branch `main`.
4. Leave database deployment set to `no` unless the SQL migration and migration history have been reviewed.
5. Edge Function deployment will skip cleanly if there are no local function source files.
6. Inspect the run logs and confirm the target project reference before accepting any production database change.

## Database migration caution
The Phase 4D school-profile access SQL has been copied into `supabase/migrations/20261107120000_secure_school_profile_update.sql`. It narrows school-table privileges and adds a same-school administrator UPDATE policy. The migration is not applied merely by committing it.

Before selecting database deployment, confirm that:
- the Phase 4D migration has not already been run manually in the Supabase SQL Editor;
- the migration is compatible with the live schema and existing grants/policies;
- a current Supabase database backup exists;
- the GitHub production environment has required reviewer approval configured.

If Phase 4D was applied manually before this migration is deployed, do not run `db push` blindly. Reconcile the remote migration history with the file first using Supabase migration tooling. Do not edit `supabase_migrations.schema_migrations` directly.

## Edge Functions
Only source folders committed under `supabase/functions/<function-name>/index.ts` are deployable by this workflow. Deployed functions whose source is absent from this repository are not downloaded, overwritten or deleted by this workflow. The workflow does not use `--prune`.

Function runtime secrets remain managed in Supabase Dashboard → Edge Functions → Secrets (or Supabase secrets tooling). They are separate from GitHub Actions deployment secrets. Do not put service-role keys in the frontend.

## Current boundary
This pipeline does not yet convert the legacy `CloudStorage` data model to relational Supabase tables. The existing application still has browser-storage reads/writes for some categories. The migration to Supabase-only persistence must be completed category by category, using existing tables, RLS and approved server-side functions. Do not clear localStorage, IndexedDB or the existing private backup during this work.

## Verification
After a deployment:
- inspect the GitHub Actions job result;
- verify the migration history in Supabase if the database job ran;
- verify the expected school RLS policy and grants;
- test school-profile updates with an authorised administrator and confirm a different school's administrator cannot update this school;
- invoke each deployed Edge Function using its intended authenticated workflow;
- confirm the live application still signs in and reads existing data.

## Recover existing deployed Edge Function source safely
The workflow now has a third input, `download_existing_functions`. Set it to `yes` to list the project's deployed Edge Functions, download their source into the temporary GitHub runner, and upload the source as a private Actions artifact named `deployed-edge-functions-source`. The artifact expires after three days.

This is a recovery/audit operation only. It does not deploy, modify or delete functions. Review the downloaded source for embedded credentials, private keys, tokens, or environment-specific values before committing any source to the repository. The Supabase CLI download does not include import maps or `deno.json` files; restore and review dependencies separately where needed. Do not enable function deployment until the recovered code has been inspected and tested.
