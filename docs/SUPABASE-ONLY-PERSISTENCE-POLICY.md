# Supabase-Only Persistence Policy

**Project:** DE-GLOBAL ACADEMY GBOKO E-RESULT SYSTEM  
**Status:** Mandatory development and release standard  
**Applies to:** Every existing and future module, page, workflow, and integration

## 1. Core rule

Supabase is the sole authoritative persistence layer for application data.

- Store structured and relational records in the Supabase Postgres database.
- Store uploaded files and binary assets in Supabase Storage.
- Use Supabase Auth for authentication and identity.
- Use server-side functions and appropriately authorised database operations for privileged workflows.
- Retrieve persisted data from Supabase when a page or workflow loads.

No application feature may use the browser, device, or a local file as its permanent or authoritative data store.

## 2. Prohibited persistence mechanisms

Do not persist application records, credentials, user preferences that must survive a session, drafts, scores, results, or uploaded-file contents in:

- `localStorage`
- `sessionStorage`
- IndexedDB
- Cache API or service-worker caches as an application data store
- Browser cookies as an application data store
- Device-local files, local JSON databases, or other on-device storage

Do not introduce a local-storage fallback when Supabase is unavailable. A failed write must remain a failed write and must be clearly reported to the user.

Authentication/session handling must use the approved Supabase Auth integration and its supported security model. Do not create a parallel custom credential store in browser storage.

## 3. Permitted transient browser state

Browser memory may hold short-lived interface state only, for example:

- Current open tab, modal, or selected view
- Temporary form values while a user is actively editing
- In-memory calculations and validation messages
- A preview assembled for the current screen
- Temporary upload progress and request state

Transient state is not a saved record. The interface must not label it as saved until Supabase confirms the write. If the page is refreshed before a successful save, unsaved transient input may be lost; communicate this clearly where relevant.

## 4. Data destination rules

| Data category | Authoritative destination |
|---|---|
| Students, admissions, enrolments | Supabase Database |
| Staff and staff profiles | Supabase Database |
| Classes, arms, subjects, assignments | Supabase Database |
| CA scores, examination scores, totals | Supabase Database |
| Results, result approvals, report-card data | Supabase Database |
| Academic sessions, terms, grading configuration | Supabase Database |
| User roles, permissions, audit records | Supabase Database and Supabase Auth as applicable |
| Signatures, stamps, photographs, logos | Supabase Storage; metadata and ownership references in Database |
| Uploaded documents and supporting files | Supabase Storage; metadata and ownership references in Database |
| System settings and durable configuration | Supabase Database |

Store file metadata, ownership, access scope, and Storage object paths in database records where needed. Do not store file bytes as browser persistence.

## 5. Required save and retrieval behaviour

Every feature that creates or changes durable information must:

1. Validate the input in the client and enforce authoritative validation on the server/database.
2. Submit the write to Supabase using the signed-in user's authorised context.
3. Apply database constraints and Row Level Security (RLS).
4. Wait for the Supabase response before displaying a successful-save state.
5. Display a clear success message only after confirmation.
6. Display a useful failure message when the request fails; do not silently save elsewhere.
7. Retrieve saved records from Supabase when the user reopens the relevant page or record.
8. Support authorised edits by updating the authoritative Supabase record.
9. Prevent duplicate submissions and duplicate records where the workflow requires idempotency.
10. Preserve auditability for sensitive academic, financial, identity, and administrative changes.

For files, upload to Supabase Storage first, then persist the relevant object path and metadata in the database. Handle partial failures safely; do not report completion if either required step failed.

## 6. Security requirements

- Enable and verify RLS on tables exposed to application clients.
- Use least-privilege policies based on authenticated identity, role, assignment, and record scope.
- Never expose the Supabase service-role key or other privileged secrets in frontend code.
- Perform privileged operations in trusted server-side functions.
- Restrict Storage buckets and object operations with appropriate policies.
- Do not rely on hidden buttons or frontend checks as security controls.
- Keep audit records for critical changes and administrative actions.
- Do not weaken existing security policies merely to make a save operation work.

## 7. Failure and offline behaviour

Supabase is authoritative. If the network or Supabase is unavailable:

- Show that the save or upload did not complete.
- Keep the current in-memory input available where practical, without persisting it locally.
- Offer a deliberate retry after connectivity returns.
- Do not switch to localStorage, IndexedDB, Cache API, local files, or another unapproved persistence mechanism.
- Do not display stale in-memory data as newly saved data.
- Clearly distinguish a pending request, a confirmed save, and a failed save.

## 8. Developer audit procedure

For each module, inspect source code and integrations for:

- Reads and writes to `localStorage`, `sessionStorage`, IndexedDB, Cache API, cookies, and local files.
- Any custom browser persistence wrapper or offline queue.
- Any data that appears saved in the interface but is not written to Supabase.
- Any write path that lacks a corresponding Supabase read/reload path.
- Missing RLS, unsafe Storage access, or exposed privileged credentials.
- Silent fallback behaviour after failed network/database requests.

Classify every finding as:
- **Compliant:** durable data is persisted and retrieved through the correct Supabase service.
- **Transient-only:** browser memory is used only for temporary interface state.
- **Non-compliant:** durable data is stored locally, or the interface falsely reports persistence.
- **Unverified:** implementation or live database behaviour has not yet been inspected and tested.

Do not claim a module is compliant based only on visual inspection or the presence of a Supabase client in the source.

## 9. Release completion checklist

A module must not be marked complete until all applicable checks pass:

- [ ] All durable records are written to Supabase Database.
- [ ] All uploaded files are stored in Supabase Storage.
- [ ] Saved data is retrieved from Supabase on page reopen and reload.
- [ ] No durable application data is written to localStorage or sessionStorage.
- [ ] No durable application data is written to IndexedDB or Cache API.
- [ ] No local-file or browser-cookie persistence is used for application records.
- [ ] Browser state is limited to temporary in-memory interface state.
- [ ] Failed Supabase writes are visibly reported; no local fallback exists.
- [ ] Success is shown only after Supabase confirms the operation.
- [ ] Database constraints and server-side validation are enforced.
- [ ] RLS and Storage policies are tested for permitted and denied access.
- [ ] No service-role key or privileged secret is exposed in frontend code.
- [ ] Create, read, update, and delete workflows are tested where applicable.
- [ ] Refresh/re-login testing confirms durable records remain available from Supabase.
- [ ] Evidence of database/Storage persistence and security tests is recorded.
- [ ] This checklist and any module-specific findings are included in the module documentation.

## 10. Existing modules and remediation

This policy applies retrospectively. Existing modules must be audited; do not assume they comply.

When a non-compliant implementation is found:
1. Identify the affected data, code path, and users.
2. Confirm the intended Supabase schema, Storage bucket, access policies, and ownership model.
3. Plan any data migration and preserve existing records.
4. Before database migrations or destructive changes, create and verify a recoverable backup and follow the project's backup gate.
5. Replace local persistence with Supabase-backed writes and reads.
6. Test permissions, failure handling, reload behaviour, and data integrity.
7. Record the fix and test evidence in the module documentation.

Do not delete local data or run destructive migrations until the replacement data has been verified in Supabase and the required backup gate has been satisfied.

## 11. Definition of done

A module is compliant only when its durable data has been demonstrated to persist in Supabase Database or Supabase Storage, its retrieval path reads from Supabase, its security controls have been tested, and no prohibited local persistence path remains. If evidence is missing, mark the module **Unverified**, not complete.
