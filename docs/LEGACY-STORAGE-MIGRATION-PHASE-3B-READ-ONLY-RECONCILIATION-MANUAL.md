# Phase 3B — Read-only Reconciliation Operational and Training Manual

## Purpose

Phase 3B compares selected legacy browser configuration with current Supabase records. It is a read-only checkpoint. It does not migrate, repair, overwrite or delete data.

## Before starting

- Keep the original JSON backup private and unchanged.
- Confirm the Supabase project is the DE-GLOBAL ACADEMY GBOKO project.
- Run the SQL only in Supabase SQL Editor using an authorised account.
- Do not use the service-role key in frontend code.
- Do not disable or weaken RLS.
- Do not run any additional write query during this phase.

## File

- `LEGACY-STORAGE-MIGRATION-PHASE-3B-READ-ONLY-RECONCILIATION.sql`

## Result-by-result procedure

1. **School identity:** Result 1 must return the known school UUID and DE-GLOBAL ACADEMY GBOKO. Stop if it does not.
2. **Class matching:** Result 2 lists each of the 30 captured class names and the number of matching school-scoped Supabase rows. Each should be one match before class mapping can be considered reconciled.
3. **Duplicate class names:** Result 3 identifies normalised duplicate names in Supabase. Any duplicate is a review item, not permission to delete or merge.
4. **Assessment configuration:** Result 4 shows the six legacy class levels and any matching Supabase configuration rows, including session, term, score maxima and active state. Compare each field; do not assume the legacy 10/10/10/70 distribution is authoritative.
5. **Teacher assignments:** Result 5 shows existing assignment IDs, teacher UUIDs, class/subject/session references and active state. The captured legacy teacher ID is blank, so do not infer a teacher UUID from the name or email in the private backup.
6. **Staff directory aggregate:** Result 6 returns only aggregate completeness counts, not staff names or contact information.
7. **Staff directory schema:** Result 7 returns column metadata only, to support a later field-level mapping review.

## Expected result format

Return the seven result sets or clear screenshots of them. For staff privacy, Result 6 and Result 7 are designed not to expose staff names, emails or phone numbers. Do not send screenshots containing unrelated personal information or authentication secrets.

## Interpretation rules

- One exact class-name match is a candidate match, not proof that all class metadata should be overwritten.
- Zero matches require manual review; do not create a new class automatically.
- More than one match is a duplicate conflict; do not merge or delete.
- Assessment configuration must be compared by school, academic session, term, class level, score maxima and active state.
- A teacher assignment must reference a real active teacher profile and the correct class, subject and session.
- Staff row counts do not prove the legacy staff entries correspond to the same people as the current directory.
- No students, enrolments, results, class passwords, browser licence metadata or image assets are migrated in this phase.

## Troubleshooting

- **School identity result is empty or different:** stop and verify project and school ID.
- **Class result has zero or duplicate matches:** preserve the result and request review.
- **Assessment result has missing or unexpected class levels:** do not create or alter configuration; inspect exact stored class_level/session/term values.
- **Teacher UUID is unexpected:** do not attempt manual linking; use the authorised account and assignment workflow.
- **SQL error mentions a missing column:** stop and return the exact error. Do not modify the query schema by guessing.
- **Results are truncated:** return them in separate messages or screenshots, preserving result labels.

## Completion criteria

- [ ] Result 1 confirms the school identity.
- [ ] Result 2 has been reviewed for all 30 class names.
- [ ] Result 3 has been reviewed for duplicate class names.
- [ ] Result 4 has been reconciled across class level, session, term and maxima.
- [ ] Result 5 has been reviewed without guessing teacher identity.
- [ ] Results 6–7 establish the staff directory aggregate and schema.
- [ ] Conflicts and unresolved mappings are documented.
- [ ] No database or browser data was changed.

Phase 3B is complete only after all result sets are reviewed. Any later write migration requires a separate approved plan, explicit conflict rules, existing RLS/Edge Function controls, dry-run validation and read-back reconciliation.
