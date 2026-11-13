# Supabase-Only Persistence Policy

**Applies to:** DE-GLOBAL ACADEMY GBOKO E-Result System  
**Authoritative persistence service:** Supabase Postgres and Supabase Storage

## Mandatory rules

1. Persistent application records must be stored in the school's Supabase project, using the appropriate relational table, RPC, or school-scoped application-state table.
2. Uploaded files and images must be stored in Supabase Storage buckets with database records or paths as appropriate.
3. Browser memory may be used only for transient interface state during the active page session. It must not be used as a persistent record store.
4. Do not introduce `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, browser databases, cookies as application storage, or other device-local persistence.
5. Do not use third-party or platform-provided cloud key/value storage as an alternative persistence layer. Supabase is the approved cloud persistence provider for this application.
6. Do not silently fall back to local, device, or alternate cloud storage when Supabase is unavailable, rejects a write, or cannot confirm a result. Display an actionable error and preserve the unsaved form state in memory for retry.
7. A save may be reported as successful only after Supabase returns a confirmed record/result. For multi-row writes, verify that the number and identity of returned records match the submitted rows. Where a workflow uses an RPC, validate its returned success result and perform read-back verification when the RPC does not return the saved records.
8. On reads, Supabase errors must be surfaced as errors. An empty result may be treated as an empty dataset only when the query completed successfully.
9. Never expose a Supabase service-role key in browser code. Client-side access must use the anon/publishable key and rely on authenticated sessions and Row Level Security.
10. Do not reintroduce automatic migrations from browser/device stores. Any exceptional historical data recovery must be an explicit, separately approved administrative migration with a documented source, destination, reconciliation, backup, and verification plan. It must not run as part of login or normal application startup.

## Implementation notes

- The main application uses the Supabase-backed `CloudStorage` layer and the `supabase-persistence.js` module for supported shared and relational records.
- The legacy browser-storage migration routine and its login-time invocation have been removed from `index.html`.
- The runtime must not reference `localStorage`, `sessionStorage`, `indexedDB`, or `window.storage`.
- Save handlers should use Supabase-returned rows (for example, `.select(...).single()` or `.select(...)`) and reject missing or incomplete confirmation before displaying success.
- Supabase Storage is permitted for files; it is part of the approved Supabase persistence architecture, not a third-party fallback.

## Review checklist for every future change

- [ ] No new browser/device persistence API or browser database.
- [ ] No third-party/platform cloud storage or fallback.
- [ ] Every persistent read and write uses the authenticated Supabase client, an approved Edge Function, or Supabase Storage.
- [ ] RLS and role/school scoping are preserved.
- [ ] A write error or missing confirmation is shown as failure, never success.
- [ ] Multi-row saves verify returned row counts/identities.
- [ ] No credentials, secrets, or service-role keys are stored in client code.
