# Legacy Browser Data Classification — Phase 3 Operational and Training Manual

## Purpose

This phase teaches administrators and migration operators how to classify the original DE-GLOBAL ACADEMY GBOKO browser backup before any data is copied to Supabase. It is a read-only review and decision process.

## Roles and permissions

- **School Administrator:** owns the decision on whether legacy school records are genuine and still required.
- **Migration Operator:** inspects the backup, prepares reconciliation reports and proposes mappings. The operator must not change production records during this phase.
- **Database Administrator:** runs approved read-only SQL in Supabase SQL Editor and returns result sets for review.
- **Developer:** reviews source-code dependencies and prepares controlled migration tooling only after the reconciliation gate passes.

No role should use a service-role key in frontend code or weaken RLS.

## Backup handling

1. Keep the original downloaded JSON file unchanged.
2. Store it in a private, access-controlled location.
3. Do not send it through public links or group chats.
4. Do not publish it to GitHub.
5. Do not clear localStorage, IndexedDB, cookies or browser data as part of this phase.
6. Remember that the backup excludes authentication tokens and Chrome cookies and did not capture the optional `window.storage` interface.

## How to read the classification

For every legacy category, assign one of these decisions:

- **Compare:** a plausible destination exists; reconcile stable IDs and values before considering a write.
- **Hold:** destination, policy, ownership or business validity is not established.
- **Exclude:** unrelated or non-operational data must not enter the school database.
- **No payload captured:** the snapshot contains no usable rows for that category; do not invent or reconstruct records.
- **Security review:** a legacy value may be a credential or privileged control and must not be copied.

## Captured snapshot findings

The backup contains 43 localStorage keys and 16 IndexedDB records. All 16 IndexedDB records match UUID-prefixed localStorage records by key and value. They are duplicate storage copies, not additional records.

Key categories and decisions:

| Category | Operational decision |
|---|---|
| School identity/configuration | Compare confirmed school fields only. Treat legacy MAIN as a browser namespace, not a school UUID. |
| 30 class arms | Compare names to the 30 Supabase classes. Do not import the empty student-name/sex slots. |
| Class password fields | Do not migrate. Review whether any remain active and replace through approved workflows if necessary. |
| 30 assessment entries | Compare with six existing Supabase configurations; do not bulk-create. |
| One subject assignment | Resolve teacher profile and session; compare with the one existing assignment. |
| Four school-prefixed staff entries | Compare with 15 Supabase staff records; no bulk import. |
| Empty staff/admin arrays | No payload to migrate from these captured arrays. |
| Student metadata | Both counters are zero; no student batches or student names were captured. Preserve existing Supabase student/enrolment records. |
| Seven activity-log entries | Preserve privately; destination audit schema not confirmed. |
| One portal-news entry | Verify authenticity and publication approval; do not publish automatically. |
| Portal settings and ID-card settings | Separate ordinary settings from licence, sales, expiry and permission metadata. Hold until a secure destination and owner are approved. |
| Signature and stamp images | Keep private; migrate only after private Storage bucket, object path, metadata and RLS are designed. |
| Developer profile and unrelated UI/workspace keys | Exclude from school migration. |
| Activation marker | Retire only after code-path review; not business data. |

## Phase 3B read-only reconciliation procedure

1. Confirm the school UUID in Supabase is the known DE-GLOBAL ACADEMY GBOKO UUID.
2. Compare all 30 legacy class names with current `classes` rows, including school scope and class IDs.
3. Compare each of the 30 legacy assessment settings with the six existing configuration rows by session, term, class level and maximum scores.
4. Resolve the legacy assignment's teacher ID using the authenticated profile and existing teacher assignment workflow. Do not infer a profile ID from a name or email.
5. Compare the four legacy staff records against current `school_staff_directory` rows using verified identifiers and profile links.
6. Record matches, unmatched records, duplicates and conflicts. A count match is not sufficient proof of identity.
7. Return the read-only query results for review before any migration SQL is prepared.

## Validation and expected outcomes

Phase 3B is successful only when each comparison identifies:
- exact matches;
- legacy-only records;
- Supabase-only records;
- duplicate candidates;
- conflicting values;
- unresolved references.

No insert, update, delete, schema change, Storage upload or RLS change is part of Phase 3B.

## Troubleshooting

- **A category is empty:** record “no payload captured”; do not fabricate values.
- **A class count matches but names/IDs differ:** keep the category on hold and inspect each row.
- **A teacher ID is blank:** resolve the account through the authorised profile/assignment workflow; never guess.
- **Legacy and Supabase settings differ:** preserve both versions in the audit report and ask the school administrator which is authoritative.
- **An asset is embedded as base64:** keep it private and defer upload until Storage policies and metadata are approved.
- **The backup omits a storage mechanism:** state the limitation; do not claim the backup is exhaustive.

## Practical training exercise

Ask the trainee to:
1. Identify the school-prefixed class-arm key.
2. Explain why its empty student slots are not student records.
3. Explain why 30 legacy assessment entries cannot automatically replace six Supabase configurations.
4. Identify why a blank teacher ID blocks a safe assignment import.
5. Explain why browser licence metadata and class password fields must not be trusted or migrated.
6. State why the original browser storage and Supabase records must remain unchanged.

## Completion checklist

- [x] Original backup received and parsed.
- [x] localStorage and IndexedDB counts recorded.
- [x] IndexedDB/localStorage duplicate equality checked.
- [x] Captured categories classified.
- [x] Known Supabase baseline considered.
- [x] No database or browser data changed.
- [ ] Phase 3B read-only reconciliation completed.
- [ ] Any later write migration separately approved, designed, tested and reconciled.

**Phase 3 classification is complete. Phase 3B is the next active gate.**
