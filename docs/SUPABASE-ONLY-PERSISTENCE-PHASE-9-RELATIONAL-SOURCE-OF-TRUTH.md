# Phase 9 — Relational source-of-truth enforcement and remaining migration controls

**Date:** 12 November 2026  
**Release commit:** `c63cdf845b296022a71b33f19107cb4e2435e5df`

## Change delivered

The previous portal settings cutover contained one remaining precedence defect: after loading `school_portal_settings`, the application merged the legacy `school_app_state.portalSettings` object back over the relational settings. That could silently reintroduce stale welcome/portal values and made the relational row non-authoritative.

The application now explicitly ignores the legacy portal-settings JSON on load. The relational `school_portal_settings` record is the single source of truth. Saving already upserts that relational row and checks the returned school ID.

## Live inventory reconfirmed

- 30 relational classes
- 17 relational Form Master assignments
- 18 relational subject-teacher assignments
- 15 relational staff-directory records
- Legacy JSON arrays: classArms 30, formMasters 0, subjectAssignments 18, portalNews 1, schoolStaff 0, portalStaffSelections 0, prefects 0, dutyRoster 0, staffDatabase 1
- Current academic session: 2026/2027
- Relational portal settings row exists; legacy placeholder portal news is not migrated or published.
- Legacy ID-card configuration contains an expired validity date and unapproved pricing/permissions; it remains untouched.

## Why other arrays were not force-imported

The legacy `staffDatabase` record has no reliable one-to-one identifier for matching the 15 relational staff records. The legacy portal news item is placeholder-looking and must not become public without school approval. Class-arm activation flags and Form Master display fields do not have direct equivalents in the current relational class schema. The 18 subject-assignment JSON objects contain denormalised teacher metadata and must not overwrite authoritative relational teacher/profile relationships.

The dedicated tables are present, but moving each screen to them requires a deliberate UI adapter and role-aware read/write behaviour. A blind JSON-to-table import could duplicate records, publish unapproved material, or change assignment activation state.

## Remaining work

1. Relational class/Form Master screen adapter, including a defined persistence location for activation state and verified current-session assignment joins.
2. Relational subject-assignment screen adapter with teacher/profile joins and role-specific permissions.
3. Staff-directory and public staff-selection adapter, with explicit school approval for each public visibility setting.
4. Portal news editor/list adapter; do not publish the old placeholder item.
5. Prefect and duty-roster editor/list adapters with student/enrolment and staff foreign-key validation.
6. School-authorised ID-card policy and permissions before populating the dedicated settings tables.
7. End-to-end role testing and device/browser recovery comparison before deleting legacy records or tools.

## Safety status

No records were deleted, no public visibility was enabled, no expired ID-card settings were reactivated, and no unverified staff/news rows were imported. This phase fixes relational portal-settings precedence but does not claim the entire migration is finished.
