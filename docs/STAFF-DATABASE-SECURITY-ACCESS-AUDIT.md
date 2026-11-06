# Staff Database — Security and Access Audit

**Project:** DE-GLOBAL ACADEMY GBOKO E-Result Portal  
**Repository:** `SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW`  
**Branch:** `main`  
**Audit date:** 6 November 2026  
**Scope:** Read-only source-code review and previously supplied Supabase schema/RLS evidence  
**Production data:** No records changed during this audit

## 1. Executive result

The Staff Database has several sound controls: the administrator screen checks the application role, persistence methods require an authenticated user and active school profile, reads and writes are scoped to that profile's school, and the database has school-scoped administrator RLS policies.

The review also identified a privacy concern in the default public staff-profile field selection. The default included phone, email, photograph and date employed. This has now been changed in the preview repository so new/default selections include only name, designation, department, qualification, specialisation and biography. Contact details, photographs and employment dates require separate administrator selection.

This source-code change does not rewrite any saved portal selection or existing staff record. Existing saved selections should be reviewed by the administrator before public display.

## 2. Controls verified in source

### Administrator screen
- `renderStaffDatabase()` returns without rendering unless `currentUser.type === 'admin'`.
- The Staff Database tab is not granted to sub-administrators through the current `showTab` permission map.
- The portal content management screen also checks for the administrator role.
- The persistence functions independently require an authenticated Supabase user and active school profile.

### School scoping
- `getStaffDirectory()` filters by the active profile's `school_id`.
- `createStaffDirectoryRecord()` derives `school_id` from the authenticated active profile and sets `created_by` from the authenticated user. It does not accept a browser-supplied school ID.
- `updateStaffDirectoryRecord()` filters by both staff row ID and the active profile's school ID.
- The update payload is allow-listed. It does not allow a browser edit to replace `school_id`, `profile_id` or `created_by`.

### Input and data integrity
- Full Name is required and trimmed.
- Status is restricted in the persistence layer to Active, Inactive or Suspended.
- Blank Staff ID and email values are normalised to null.
- Qualification selection is limited to eight in the administrator form.
- Department “Others” requires a description.
- Public visibility is blocked by the form until the required profile fields are supplied.
- No staff-delete action is exposed.
- New photo uploads remain blocked pending Storage policy verification.

## 3. Database/RLS evidence

The previously supplied schema and policy review reported:
- RLS enabled on the supplied public tables.
- Staff-directory SELECT, INSERT and UPDATE policies restricted to an active administrator profile in the same school.
- No staff-directory DELETE policy supplied.
- School-scoped uniqueness for non-empty Staff IDs and email addresses.
- A profile may be linked to only one staff-directory row per school.

The code review does not replace a live negative test. A non-administrator account and a second-school account should be used to confirm denied access against the current deployed database policies.

## 4. Public profile privacy improvement

The original default public-field selection included:
- photograph;
- name;
- designation;
- department;
- qualification;
- specialisation;
- phone;
- email;
- date employed; and
- biography.

That was broader than a privacy-first default. The default has now been changed to:
- Name;
- Designation;
- Department;
- Qualification;
- Specialisation / Subject; and
- Biography.

Phone, email, photograph and date employed are no longer selected by default. An administrator must deliberately select any of these fields for publication.

**Important:** Existing saved `portalStaffSelections` are not automatically rewritten. The administrator must inspect each saved selection and deselect any field that should not be public. A staff record should remain unpublished unless the staff member's details have been reviewed and publication is authorised.

The public staff list currently applies the record-level checks `status === 'Active'` and `showOnPortal === true`, and then applies the saved per-field selection. This is an application-level display control, not a substitute for database RLS or consent/approval procedures.

## 5. Important architecture boundary

The Supabase Staff Database read/write path is school-scoped and authenticated. The public portal display path currently reads its staff directory and field selections from the legacy browser-storage layer. This means:
- Supabase is authoritative for administrator edits made through the Staff Database screen;
- the legacy portal display copy and the Supabase directory are not yet a fully unified live read path;
- a future integration must fetch only approved public fields through a deliberately designed, safe public read mechanism; and
- public access must never be granted by weakening the private staff-directory RLS policy.

Do not expose the full staff table through an anonymous query or add a broad public SELECT policy to `school_staff_directory`. A future public directory should use a narrowly scoped view or server-side endpoint that returns only approved fields for records that are Active and explicitly published.

## 6. Tests completed and tests still required

### Completed in this review
- Read-only inspection of the administrator screen role guard.
- Read-only inspection of the persistence layer's authenticated-user and active-profile requirements.
- Read-only inspection of school scoping and update payload allow-list.
- Read-only inspection of public display filtering by active status and record-level publication flag.
- Changed default public-field selections to exclude contact details, photographs and employment dates.
- No staff records, profile links, RLS policies or database schema changed.

### Required live acceptance tests
These require authorised test accounts and should be performed without changing real staff data:

1. **Administrator read:** sign in as the school administrator and confirm the 15 existing rows load.
2. **Administrator update:** use a school-approved test record or a harmless reversible edit authorised by the administrator; confirm read-back.
3. **Sub-administrator denial:** sign in as a sub-administrator and confirm the Staff Database screen is not available and direct persistence calls are denied by RLS.
4. **Form Master denial:** confirm a Form Master cannot read or write the staff directory through the client.
5. **Student/public denial:** confirm a student session cannot query the private staff table.
6. **Cross-school denial:** use an account belonging to another school and confirm it cannot read or update this school's staff rows.
7. **Publication gate:** confirm incomplete records cannot be published.
8. **Field minimisation:** confirm new/default public selections exclude phone, email, photo and date employed.
9. **Existing selections:** inspect previously saved selections for personal contact information and remove fields that are not approved for public display.
10. **No deletion:** confirm no staff-delete control or client-side deletion workflow exists.

Do not use service-role credentials in the browser to perform these tests. Do not relax RLS to make a test pass.

## 7. Outstanding risks and next work

1. Unify the public directory with a narrowly scoped published-profile read endpoint or view.
2. Review existing saved portal field selections before enabling any staff profiles publicly.
3. Verify Supabase Storage policies before enabling staff photo uploads.
4. Perform the live role and cross-school negative tests listed above.
5. Consider a separate audit trail for staff profile edits and publication changes, with append-only server-side recording.

## 8. Audit conclusion

**Source review: satisfactory with follow-up controls.** The administrator CRUD path demonstrates authentication and school scoping in its client helper, and the supplied RLS review supports the intended database boundary. The privacy-first default field change has been committed to the preview repository. However, live negative tests and the future public-directory read-path integration remain outstanding. This audit must not be interpreted as independent penetration testing or proof that all production permissions have been exercised.
