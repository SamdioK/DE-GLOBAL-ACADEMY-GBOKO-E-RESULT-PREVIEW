# Phase 5C — Least-Privilege Permissions Migration Manual

**System:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Migration:** `20261107195500_phase_5c_read_only_school_data_grants.sql`  
**Target:** Production Supabase database  
**Effect:** Permission changes only; no row data is modified.

## 1. Purpose

The Phase 5C audit found broad table-level and column-level grants to `anon` and `authenticated` on school classes, Form Master assignments, teacher assignments, students and student enrolments. Existing RLS policies on these five tables are SELECT-only and school-scoped. This migration aligns SQL privileges with the current access model: authenticated users may read rows permitted by RLS; direct browser writes are denied.

## 2. Scope

The migration applies to:

- `public.classes`
- `public.form_master_assignments`
- `public.teacher_assignments`
- `public.students`
- `public.student_enrolments`

It revokes table-level and independently granted column-level privileges from `anon` and `authenticated`, then grants `SELECT` to `authenticated` only. It does not revoke `service_role` privileges, alter RLS, alter policies, change database rows, or change foreign keys/indexes.

## 3. Application workflow impact reviewed

The current browser code reads classes, students, enrolments and teacher assignments directly. Form Master assignment creation, update and removal are sent through the `manage-form-master` Edge Function. The current `index.html` contains no direct `.insert()` or `.update()` calls against these five tables. Result score writes target the separate results workflow and are outside this migration.

This is a source-code review, not proof that no external client, future workflow or third-party integration writes directly to these tables. After the migration, any such direct authenticated write will fail until moved to an explicitly authorised server-side workflow.

## 4. Pre-execution checklist

Before running:

1. Confirm a current recoverable Supabase backup exists.
2. Confirm the latest deployed application uses the reviewed Form Master Edge Function workflow.
3. Confirm no other application or integration relies on direct authenticated writes to these five tables.
4. Confirm the migration SQL matches the live column list from the Phase 5C audit.
5. Confirm the operator is connected to the intended production Supabase project.
6. Keep the SQL editor output available for post-migration verification.

If any item cannot be confirmed, do not run the migration yet.

## 5. Execution

1. Open Supabase Dashboard → SQL Editor.
2. Open the migration file from the repository.
3. Review the entire script.
4. Run it once.
5. Do not manually edit individual statements or run only part of the transaction.

## 6. Post-migration verification

Run the Phase 5C read-only schema/security audit again. Expected:

- RLS remains enabled on all five tables.
- `anon` has no table-level or column-level grants on the five tables.
- `authenticated` has table-level SELECT only.
- `authenticated` has no INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES or TRIGGER privileges.
- Existing school-scoped SELECT policies remain unchanged.
- Foreign keys and indexes remain unchanged.

Then test in the application:

1. Sign in as School Administrator; open class views and confirm all 30 classes load.
2. Open Form Master management; confirm existing assignments load through the Edge Function.
3. Sign in as the assigned subject teacher; confirm class/subject assignment and roster can be read.
4. Open result entry and confirm the student roster loads.
5. Confirm score saving still uses the separate results workflow.
6. Test any student import, admission, transfer, archival, teacher assignment or class-creation screens before declaring those workflows operational. They must use reviewed server-side operations; direct table writes are intentionally denied.

## 7. Stop and report

Stop if any read screen fails, a required workflow attempts a direct write, the RLS policies differ from the audit, or the privilege verification does not match the expected state. Do not restore broad grants as a quick fix. Report the exact error and migrate the affected write path to a narrowly authorised Edge Function/RPC with validation, audit logging and school/role checks.

## 8. Rollback approach

There is no broad-grant rollback script. Do not re-grant ALL privileges to `anon` or `authenticated`. If a legitimate workflow is blocked, identify the exact operation and implement a least-privilege, role-scoped server-side path. Any exceptional grant must be separately reviewed and documented.

## 9. Training exercise

The trainee should explain the difference between SQL grants and RLS, why both layers matter, why service-role workflows are kept separate from browser writes, and how to verify that a school-scoped SELECT policy still restricts returned rows.
