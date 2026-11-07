# Phase 5B — School Profile Supabase Pre-flight Audit
## Operational and Training Manual

**System:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Phase:** 5B — School Profile  
**Stage:** Read-only pre-flight; no application cutover yet

## 1. Purpose

Confirm whether the prepared Phase 4D secure school-profile migration is recorded in Supabase, inspect the actual privileges and RLS policies on `public.schools`, and verify the exact school row and columns before connecting the school profile interface to Supabase.

The preview and live site share the same Supabase project. Treat every database inspection as production context and do not run write statements during this phase.

## 2. Required role

An authorised school/project database administrator runs the complete file [Phase 5B Read-only Pre-flight SQL](SUPABASE-FIRST-PERSISTENCE-PHASE-5B-PREFLIGHT-AUDIT.sql) in the SQL Editor for project `rvmcqvfuioxmbtvgdptb`.

## 3. Procedure

1. Open the correct Supabase project and SQL Editor.
2. Open the Phase 5B pre-flight SQL file in GitHub.
3. Copy and run the complete script without editing it.
4. Preserve all eight labelled result sections and the NOTICE output.
5. If any statement errors, stop and return the exact error and the preceding results. Do not improvise a replacement query or run Phase 4D.
6. Separately, an authorised operator may run `supabase migration list --linked` from the repository's protected GitHub Actions environment or another trusted CLI environment. This is a read-only history check. Do not run `db push`.

## 4. How to interpret the results

- **Result 1:** identifies whether the standard CLI migration history table exists. Missing history table means status is unknown, not that Phase 4D is unapplied.
- **Result 2:** reports whether version `20261107120000` is present in the standard history table. Confirm against `supabase migration list --linked` before any deployment decision.
- **Results 3–4:** show current table and column privileges. Do not infer effective access from RLS alone.
- **Result 5:** lists current policies. Check for the Phase 4D policy and retain existing SELECT policies.
- **Result 6:** confirms whether RLS is enabled and forced.
- **Result 7:** confirms exact columns and data types; no assumptions about schema are permitted.
- **Result 8:** verifies the DE-GLOBAL ACADEMY GBOKO row by its known UUID. Do not overwrite blank or populated fields during this audit.

## 5. Stop conditions

Stop without changing anything if:
- migration history is unavailable or inconsistent between SQL and CLI;
- the Phase 4D migration is already applied but the live grants/policy do not match its expected state;
- RLS is disabled;
- unexpected grants or policies appear;
- the school UUID does not return exactly the expected school;
- any result is incomplete or an SQL error occurs.

Do not re-run the Phase 4D SQL merely because its history row is absent. First reconcile the CLI migration list, live grants and policy state. Do not apply migrations from the protected deployment workflow at this stage.

## 6. School profile field mapping

The current form mixes several distinct data categories:

| Current form field | Supabase destination / decision |
|---|---|
| School name | `schools.name` |
| Email | `schools.email` |
| Phone | `schools.phone` |
| Address | `schools.address` |
| Session | Read from `academic_sessions`; never write into `schools` |
| Principal name | Not a `schools` column in the reviewed mapping; defer to a verified staff/profile relationship |
| School logo | Supabase Storage first; store object path/URL only after bucket policy review |
| Principal signature | Private Storage design required |
| School stamp and stamp signature | Private Storage design and metadata required |

The current form's Save School Info, logo, signature and stamp handlers still write through legacy browser storage. Do not claim these are cloud-saved. This pre-flight does not change those handlers.

## 7. Acceptance criteria for this pre-flight

- All eight result sections are captured.
- The migration history status is reconciled with the linked CLI migration list.
- The live grants, policies and RLS state are understood.
- The correct school row and actual schema are confirmed.
- No database records, grants, policies, schema, Storage objects or browser data are changed.

Only after review may a separate implementation step add a narrowly scoped Supabase school-profile read/update method, replace the form's legacy save path, and perform administrator/non-administrator/cross-school tests. Image uploads remain a separate Storage phase.

## 8. Training exercise

Have the trainee identify the Phase 4D migration version, distinguish a missing history table from an unapplied migration, locate the school UPDATE policy, and map the session and principal fields to their correct data domains. The trainee must explain why no write or deployment is permitted during this pre-flight.
