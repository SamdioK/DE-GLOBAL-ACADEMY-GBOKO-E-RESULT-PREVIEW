# Phase 5C — Class Schema and Security Audit Manual

**System:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Stage:** Read-only database inspection  
**Database:** Production Supabase project  
**Writes:** None

## Purpose

Inspect the live schema and security controls for classes, assignments, students and enrolments before changing the class-management read path. This audit complements the application-level integrity checks; it does not modify data.

## Required operator

An authorised database administrator with access to the Supabase SQL Editor.

## Procedure

1. Open the Supabase project used by the E-Result application.
2. Open SQL Editor.
3. Open [Phase 5C Class Schema and Security Audit SQL](SUPABASE-FIRST-PERSISTENCE-PHASE-5C-CLASS-SCHEMA-SECURITY-AUDIT.sql) from the repository.
4. Copy and run the complete SQL file without editing it.
5. Capture all seven result sections, including empty result sets. An empty privileges or policies result is still meaningful.
6. Return the result screenshots or copied text for review.
7. If any query errors, stop and send the exact error. Do not change grants, policies, tables or records.

## Result interpretation

1. **Table security:** confirms which target tables exist and whether RLS is enabled/forced.
2. **Columns:** records actual field names, data types, nullability and defaults. Implementation must not assume columns not returned here.
3. **Table grants:** shows table-level permissions for anon/authenticated/PUBLIC.
4. **Column grants:** detects column-level privileges that table-level inspection can miss.
5. **Policies:** identifies permitted operations and the exact RLS conditions.
6. **Foreign keys:** confirms class, teacher, subject, student and session relationships.
7. **Indexes:** identifies unique constraints/indexes and lookup support relevant to class identity and assignments.

## Stop conditions

Do not implement or deploy class writes if:
- any required table is missing;
- RLS is unexpectedly disabled;
- anon has write privileges;
- authenticated write privileges are broader than the approved workflow requires;
- policy conditions do not scope records to the authenticated user's school and role;
- a required foreign key or unique constraint is absent or differs from the expected relationship;
- a result is incomplete or any query errors.

Do not create, delete or modify rows or security objects as part of this audit.

## Expected next step

After review, add a narrow authenticated, school-scoped class read method using the confirmed column names. Replace class identity reads first. Keep Form Master and teacher assignments in their existing authorised workflows. Migrate the student roster separately; do not remove the legacy roster path until its replacement has been implemented and tested.
