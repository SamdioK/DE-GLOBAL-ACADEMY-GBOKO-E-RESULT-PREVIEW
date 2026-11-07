# Phase 5C — Class Configuration Source Inventory and Cutover Plan

**System:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Repository:** SamdioK/DE-GLOBAL-ACADEMY-GBOKO-E-RESULT-PREVIEW  
**Branch:** main  
**Stage:** Read-only source inventory and implementation plan  
**Database writes:** None

## 1. Purpose

Document the class configuration code paths before replacing the legacy browser-storage implementation with Supabase-backed class records. This phase is deliberately non-destructive. It does not create, update, delete, rename or re-import any class, student or assignment record.

## 2. Verified database baseline

The administrator ran the existing read-only audits in the application. Results supplied on 7 November 2026:

- 30 Supabase class rows visible for the school.
- 30 legacy class-arm names; all 30 match Supabase.
- Zero duplicate class names.
- Zero missing classes in either direction.
- 743 students and 743 student enrolments.
- Zero students without enrolment.
- Zero orphan student references.
- Zero missing class references in enrolments.
- Zero missing academic-session references in enrolments.
- Zero duplicate student/session enrolment pairs.
- 16 Form Master assignments, with zero reported missing teacher IDs, class references, academic sessions, subject references, duplicate combinations or school ID mismatches.
- 1 teacher/subject assignment, with zero reported missing teacher IDs, class references, academic sessions, subject references or duplicate combinations. The final teacher-assignment school-ID-mismatch count was not included in the operator's pasted output.
- Assignment audit cannot independently count teacher profile existence because profile SELECT access is restricted by RLS.

These results establish a clean reference baseline. They do not prove that every class-related UI path is Supabase-backed.

## 3. Source-code inventory

### 3.1 Legacy class state

In `index.html`, the global `classArms` array is used as a combined UI object. `generateArms()` constructs 30 BASIC7–BASIC9 and SS1–SS3 arms, A–E, and gives each arm fields including:

- `id` and `name`
- `formMaster` and `formMasterEmail`
- `activated`
- `studentNames` and `studentSexes`

The array is loaded in `loadSchoolData()` from `cloudStorage.load('classArms')`. If no value is found, the application generates a browser-side default list. `migrateOldClassNames()` also normalises the legacy roster arrays and old class labels.

### 3.2 Legacy writes

`saveAllData()` writes the complete `classArms` array to `cloudStorage.save('classArms', classArms)`. The same save routine also writes separate legacy `formMasters` and `subjectAssignments` arrays.

The following class-related paths still mutate legacy objects and/or call `saveAllData()`:

- `renderArms()`: Form Master selection is written into `classArms[].formMaster` and `formMasterEmail`.
- The student-name editor in `renderArms()`: edits `studentNames` and saves through `saveAllData()`.
- `showActivationPanel()`, `toggleClassActivation()`, `activateAllInClass()`, and `deactivateAllInClass()`: change `classArms[].activated` and save through `saveAllData()`.
- `toggleClassActivationMasters()`: also changes the legacy activation flag.
- `removeFormMaster()` and `clearAllMasters()`: clear Form Master details in the legacy class array and save it.
- `processStudentNamesImport()`: imports names and sex values into `classArms[].studentNames` and `studentSexes`, then calls `saveAllData()`.

### 3.3 Existing Supabase Form Master management

The Form Master management path in `renderFormMasterManagement()` already reads the school-scoped `classes` table and invokes the `manage-form-master` Edge Function to list assignment records. It builds the class assignment interface from the returned Supabase class UUIDs and assignment records.

This is the authoritative assignment path to preserve. Do not duplicate these assignments into a new class JSON field or re-import the 16 existing assignments.

### 3.4 Student roster and results dependencies

The legacy result-entry interface still reads class roster names and sex values from `classArms[].studentNames` and `studentSexes`. The result-entry form and roster import therefore cannot be cut over merely by replacing the class-name tiles.

The database already contains 743 students and 743 enrolments. The next student/roster work must map the result-entry UI to `students` and `student_enrolments` and preserve the existing student IDs, enrolment IDs, class UUIDs and session UUIDs. Do not bulk import or overwrite the 743 records.

## 4. Domain separation required

The cutover must keep these concepts separate:

| Concept | Authoritative destination |
|---|---|
| Class identity, level and arm | `public.classes` |
| Form Master assignment | `public.form_master_assignments` through the verified Edge Function |
| Subject teacher assignment | `public.teacher_assignments` through its verified authorised workflow |
| Student identity | `public.students` |
| Student class/session placement | `public.student_enrolments` |
| Student register ordering and any approved roster-specific attributes | To be mapped against existing student/enrolment columns before implementation |
| Temporary tile selection, open panel and search state | Browser memory only |

A class row must not contain embedded student arrays, staff identities, passwords or assignment state.

## 5. Cutover sequence

1. Confirm database grants, RLS policies, columns, foreign keys and indexes for `classes`, `form_master_assignments`, `teacher_assignments`, `students` and `student_enrolments`.
2. Add a narrow authenticated, school-scoped `getClasses()` persistence method that returns only the approved class fields and preserves the database UUID.
3. Load the class selector and class tiles from Supabase rows. Do not generate or insert missing class records from the browser.
4. Keep Form Master changes exclusively in the existing `manage-form-master` Edge Function workflow.
5. Remove legacy activation toggles only after confirming the corresponding Supabase assignment activation model and login checks.
6. Migrate roster display/import separately to the approved student/enrolment workflow. Do not use the 100-slot legacy arrays as the permanent roster.
7. Update every class consumer and verify result entry, student selection, Form Master login, subject teacher login, release filters, reports and ID-card class labels.
8. Read back after any approved write, test permitted and denied roles, and verify the same records from another device.
9. Disable only the class category's legacy writes after all dependent screens pass.
10. Retain the browser backup and document rollback steps.

## 6. Stop conditions

Do not implement class writes or remove legacy paths if:

- class UUIDs or class names do not reconcile;
- the school-scoped SELECT policy/grants are not confirmed;
- an assignment workflow cannot be traced to its authorised Edge Function/RPC;
- student roster fields cannot be mapped to actual database columns;
- a dependent screen still requires an unmigrated legacy field;
- a test would mutate production records without an approved test record and cleanup plan.

## 7. Training exercise

The trainee should explain why the 30 class rows must not be re-created, why the 16 Form Master assignments must remain separate from class identity, and why student roster import cannot be migrated by changing only the class selector.

## 8. Current outcome

**Source inventory complete; implementation not yet cut over.**

No database records or browser data were changed by this inventory. The next implementation task is to confirm the live class-related schema and RLS/grants, then add a read-only Supabase class loader and replace class identity reads without changing assignment or roster workflows.
