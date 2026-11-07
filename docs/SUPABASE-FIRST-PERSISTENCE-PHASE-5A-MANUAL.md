# Phase 5A — Supabase-First Persistence Architecture and Training Manual

## Purpose

This phase establishes how the DE-GLOBAL ACADEMY GBOKO E-Result System will move from browser-dependent storage to Supabase as its permanent source of truth. It is an architecture and planning phase; it does not change production data.

## Roles

- **School Administrator:** confirms school information and approves school configuration changes.
- **Portal Developer:** maintains application code and trusted privileged workflows.
- **Database Administrator:** verifies schema, RLS, grants, migration history, backups and database changes.
- **Migration Operator:** inventories legacy data, prepares comparisons and records reconciliation outcomes.
- **Staff users:** use only the data and actions allowed by their assigned roles.

## Target behaviour

- All school records are loaded from Supabase after sign-in.
- All permanent changes are saved to Supabase and confirmed by a read-back.
- Uploaded files are stored in Supabase Storage, with object paths recorded in database rows.
- Supabase Auth controls identity and sessions.
- Browser storage is not a fallback for failed permanent writes.
- A failed Supabase write must produce an error, not a success message or a silent local save.

## How to operate the migration

1. Work on one data category at a time.
2. Identify every screen that reads or writes the category.
3. Verify the destination table, columns, constraints, RLS and approved RPC/Edge Function.
4. Produce a read-only comparison before changing records.
5. Preserve a source-device backup and a database backup.
6. Implement the category's Supabase read/write methods.
7. Test success, validation failure, network failure, unauthorised access and cross-school access.
8. Reload the record from Supabase to confirm persistence.
9. Sign in on a second device and verify the same record appears.
10. Only then disable that category's legacy browser storage path.
11. Update the migration map and this manual series with the exact completed work.

## Critical cautions

- The preview and live site share the same Supabase project. Preview writes are production writes.
- The 743 student records and 743 enrolments already exist in Supabase. Do not bulk import them again.
- Do not directly insert profiles or change privileged roles from browser code.
- Do not replace results, enrolments or student imports with a generic JSON table.
- Never expose service-role credentials.
- Do not delete local browser data or the preserved backup during migration.
- Storage bucket names in the architecture document are proposals only; inspect actual buckets and policies first.

## Training exercise

For a future approved test category, trainees should:
- identify the source and destination;
- prepare a dry-run reconciliation;
- explain the relevant RLS policy;
- perform an authorised test write in staging;
- reload the row from Supabase;
- sign in from a second device;
- demonstrate that a failed write is not reported as successful;
- record the result and rollback method.

## Completion

Phase 5A is complete when the architecture and migration gates are documented. Each later category has its own implementation and training manual. The system must not be described as fully Supabase-reliant until every permanent data category has passed its cutover checklist.
