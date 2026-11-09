# Supabase-only persistence — Phase 7C schema foundation

**Date:** 9 November 2026  
**Project:** DE-GLOBAL ACADEMY GBOKO E-RESULT SYSTEM  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Supabase project:** `rvmcqvfuioxmbtvgdptb`

## Work completed

Created seven school-scoped relational tables for portal and operational data:

- `school_portal_settings`: welcome notice, term weeks and portal availability. Platform licensing and sales data are deliberately excluded.
- `school_portal_news`: individually addressable announcements with publication state and timestamps.
- `school_prefect_appointments`: appointments linked to student and optional enrolment records, with term dates and Storage path for photo.
- `school_duty_roster`: dated duties linked to a staff directory record or staff profile.
- `school_id_card_settings`: school-owned card validity and contact/branding settings.
- `school_id_card_permissions`: separate account-level grants, with the permission editor restricted to the portal developer.
- `school_portal_staff_selections`: per-staff public display field choices and display order.

All seven tables have RLS enabled and forced. Each has an explicit policy. Policies scope records to the authenticated active profile's school. The prefect policy additionally checks that the selected student and enrolment belong to the same school and student. Duty-roster and staff-selection policies validate related staff records. ID-card permission changes are limited to the portal developer and target accounts in the same school.

## Verification

A post-migration query confirmed all seven tables exist, have RLS enabled and forced, and each has one explicit policy. The Supabase security advisor was also run. It reported pre-existing findings elsewhere in the project (including RLS-enabled tables without policies, callable SECURITY DEFINER functions, and disabled leaked-password protection). These findings were not modified as part of this schema migration because changing existing permission functions without reviewing their callers could break authentication and student workflows.

## Important cutover status

This is a schema foundation, **not a completed application cutover**. Existing `index.html` call sites still use the legacy `CloudStorage` abstraction for several of these domains. Do not delete the browser fallback until the corresponding read and write paths have been converted and tested.

No existing student, staff, result, class or legacy backup records were overwritten or deleted. No legacy news/roster records were imported automatically because the available browser snapshot is incomplete and some values need reconciliation.

## Next work

1. Implement Supabase read/write adapters for each new domain.
2. Update the administrator forms and public portal to consume only approved Supabase-backed data.
3. Upload news images and prefect/staff photos to Storage and persist object paths, not base64 data URLs.
4. Migrate and reconcile legacy values where their ownership and identity are verifiable.
5. Replace the remaining legacy storage reads and writes domain by domain.
6. Run authenticated-role, public-read and cross-school negative tests before removing the old storage layer.
