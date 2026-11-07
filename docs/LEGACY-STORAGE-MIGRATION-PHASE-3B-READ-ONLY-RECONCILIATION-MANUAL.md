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


## Actual Phase 3B results and interpretation (2026-11-07)

All seven result sets and the follow-up teacher profile lookup were returned and reviewed.

### Confirmed results

1. **School identity:** Confirmed as DE-GLOBAL ACADEMY GBOKO, school UUID `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`.
2. **Class matching:** All 30 legacy class names have exactly one school-scoped Supabase match. No class creation or replacement is required.
3. **Duplicate class names:** The normalised-name audit returned one row per class name, with no duplicate class names.
4. **Assessment configuration:** The first join returned NULL because legacy levels omit a space (`BASIC7`, `SS1`) while Supabase stores a space (`BASIC 7`, `SS 1`). A separate read-only inspection confirmed six existing active configurations for session 2026/2027, First Term. All six have CA1=10, CA2=10, CA3=10, examination=70 and total=100. The values match the legacy configuration. This was a comparison-query naming mismatch, not missing configuration data. No configuration write is required.
5. **Teacher assignment:** One existing BASIC7A Mathematics assignment was returned for session 2026/2027. Its assignment status is inactive. A follow-up profile/directory lookup confirmed the teacher UUID links to an active same-school `subject_teacher` profile and matching active staff-directory entry for Hyande Dio Samuel, designation Subject Teacher. The legacy teacher ID was blank, so this confirms the existing Supabase identity but does not prove the assignment should be activated. Keep the assignment inactive until the authorised school administrator confirms the intended operational status and uses the normal assignment workflow.
6. **Staff directory aggregate:** 15 rows; all 15 linked to profiles; 0 have staff IDs; all 15 have email addresses. Staff IDs remain manually administered and must not be auto-generated for this migration.
7. **Staff directory schema:** The existing `school_staff_directory` contains the 21 returned columns, including profile link, staff identity, employment, contact, publication and audit metadata. Do not create a duplicate staff table.

### Completion checklist

- [x] Result 1 confirms the school identity.
- [x] Result 2 confirms one match for all 30 legacy class names.
- [x] Result 3 confirms no duplicate normalised class names.
- [x] Result 4 reconciles all six levels, session, term, maxima and active state after correcting for the naming convention.
- [x] Result 5 reviewed; teacher identity/profile is confirmed.
- [x] Results 6–7 establish staff aggregate and schema.
- [x] Conflicts and unresolved decisions documented.
- [x] No database or browser data changed.

### Outstanding decision

The only operational decision from this reconciliation is whether the existing BASIC7A Mathematics assignment should remain inactive or be activated. The teacher profile and staff record are active, but this does not automatically authorise activating the assignment. Obtain administrator confirmation and use the existing assignment workflow if a change is required.

**Phase 3B read-only reconciliation is complete.** This completion records review of the audit only. It is not a data migration, does not authorise bulk import, and does not authorise any database write. Preserve the original browser backup and legacy storage.
