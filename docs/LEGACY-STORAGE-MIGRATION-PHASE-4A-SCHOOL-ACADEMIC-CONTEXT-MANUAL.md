# Phase 4A — School Identity and Academic Context
## Operational and Training Manual

**Project:** DE-GLOBAL ACADEMY GBOKO  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Phase:** 4A — Category-by-category migration design and validation  
**Mode:** Read-only inspection and mapping; no migration writes

## 1. Purpose

This phase validates the captured legacy school profile and academic context against the existing Supabase records. It establishes the safe mapping for school identity, academic session and terms before any application code is changed.

It does not migrate data, upload images, update school fields, change current sessions/terms or alter RLS.

## 2. Roles and responsibilities

- **School Administrator:** confirms the authoritative school address/contact details and the intended current academic session and term.
- **Migration Operator:** compares the preserved legacy snapshot with Supabase and documents differences. Must not alter production data during this phase.
- **Database Administrator:** runs the supplied SELECT-only SQL in Supabase SQL Editor and returns all five labelled results.
- **Developer:** reviews the frontend persistence path and prepares a narrowly scoped implementation only after the read-only checks and administrator decisions are complete.

## 3. Source data and proposed mapping

The preserved school-prefixed `schoolInfo` object contains:

| Legacy field | Captured value / state | Candidate destination | Initial decision |
|---|---|---|---|
| `name` | DE-GLOBAL ACADEMY GBOKO | `schools.name` | Compare; retain confirmed existing value |
| `address` | Gboko | `schools.address` | Compare; administrator must confirm whether this is the complete official address |
| `email` | Empty | `schools.email` | Do not overwrite a populated destination with blank legacy data |
| `phone` | Empty | `schools.phone` | Do not overwrite a populated destination with blank legacy data |
| `session` | 2026/2027 | `academic_sessions.name` | Compare to existing session; do not store as a second source of truth in `schools` |
| `logo` | Empty | `schools.logo_url` or approved Storage object path | No asset to migrate from this field |
| `principalSignature` | Empty | No confirmed destination | Defer |
| `principalComment` | Empty | No confirmed destination | Defer |
| `schoolStamp` | Embedded PNG data URL | Private Storage object plus approved metadata, if required | Defer; do not put base64 in a URL column |

The legacy record does not supply a reliable term ID or term number. Term identity must come from the existing `terms` table and an explicit administrator decision about which term is current.

The `schools` schema inventory includes `id`, `name`, `address`, `phone`, `email`, `logo_url`, and `motto`. The academic context is held in `academic_sessions` and `terms`, each school-scoped. Do not invent a destination field for principal signature, principal comment or school stamp.

## 4. Important persistence finding

Source inspection shows that the current application still loads `schoolInfo` through `cloudStorage.load('schoolInfo')` and saves it through the legacy `saveAllData()` path. The reviewed `supabase-persistence.js` helper includes an authenticated, school-scoped read of the `schools` row in its audit helper, but it does not currently expose a school-profile update method.

Therefore, the presence of a Supabase school record does not mean the school-profile form is cloud-persistent. Do not claim that this category has migrated until a secure write path has been designed, implemented and tested.

## 5. SQL file and execution procedure

Run:

- `LEGACY-STORAGE-MIGRATION-PHASE-4A-SCHOOL-ACADEMIC-CONTEXT.sql`

The file contains five SELECT-only result sections:

1. **School record:** reads the known school row and supported identity/contact fields.
2. **Academic sessions:** reads school-scoped session names, dates and current flags.
3. **Terms:** reads school-scoped term names, numbers and current flags.
4. **Schema inventory:** verifies the actual columns and data types in the three tables.
5. **RLS policies:** reports RLS enabled/forced state and existing policy commands/expressions.

If Supabase SQL Editor does not display all result grids from one execution, run each labelled RESULT SELECT separately. Do not modify the SQL by guessing if a query errors; return the exact error.

## 6. Validation rules

- The school UUID must remain `b135a823-0a04-4b4b-86dd-2b20ea5e9fac`.
- The existing school row is authoritative unless the administrator confirms a correction.
- A blank legacy phone or email is not permission to clear a populated Supabase field.
- The legacy address value `Gboko` must not replace a more complete verified address without administrator approval.
- The legacy session string must match an existing school-scoped academic session. Do not create another 2026/2027 session if one already exists.
- Do not infer the current term from the legacy profile object. Use the existing term records and the administrator's explicit decision.
- Do not alter `is_current` flags as part of this audit.
- Do not expose or migrate base64 signature/stamp assets in this phase.
- Preserve the original browser backup and all browser-local records.
- Keep RLS enabled. No policy should be weakened to make a future form save succeed.

## 7. Expected outputs

For each result set, record:
- exact match;
- legacy-only value;
- Supabase-only value;
- conflict requiring administrator confirmation;
- policy or schema limitation.

No write SQL will be prepared until the school row, academic session, terms and RLS policies are understood.

## 8. Troubleshooting

- **School row is missing:** stop and confirm the Supabase project and school UUID. Do not insert a new school.
- **More than one 2026/2027 session appears:** do not choose one automatically; compare dates/current flags and request administrator confirmation.
- **No current term is marked:** report it as a configuration decision; do not set one during this audit.
- **Legacy blanks differ from populated Supabase fields:** preserve the populated destination until the administrator verifies a correction.
- **No UPDATE policy is visible:** do not bypass RLS. Design an authorised server-side or policy-compliant path after review.
- **Schema differs from the documented inventory:** stop and return the exact column inventory.

## 9. Completion checklist

- [ ] Result 1 confirms the school row and fields.
- [ ] Result 2 confirms the existing academic session(s).
- [ ] Result 3 confirms the existing term records and current flags.
- [ ] Result 4 confirms actual columns and types.
- [ ] Result 5 confirms RLS state and policies.
- [ ] Administrator decisions on address/contact/current session/current term are recorded.
- [ ] No database or browser data was changed.
- [ ] A separate implementation plan is approved before any write path is built.

**Phase 4A is complete only after all five results and the administrator's configuration decisions are reviewed.**
