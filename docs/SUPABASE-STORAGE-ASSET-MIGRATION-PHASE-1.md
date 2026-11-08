# Supabase Storage asset migration — Phase 1

## Scope and findings
The existing `student-passports` bucket is private and already has school-scoped administrator policies plus a Form Master read policy. Its dedicated `passport-registration.js` workflow uploads files directly to Storage and stores the path in `student_passports`.

The main application still embeds several image files as base64 data URLs in legacy browser persistence. Confirmed examples include subject teacher signatures, administrator profile logos, school logos, student photos, management profile photos, portal news photos and prefect photos. The staff directory has a `photo_url` column, but its current records are database-backed independently of Storage.

## Phase 1 deliverables
- `school-public-assets`: for images explicitly approved for public display (school logo, public staff photos and approved news images).
- `school-private-assets`: for signatures and internal PDF documents. This bucket is private.
- `school-assets.js`: authenticated upload, signed URL and delete helper. It resolves the school from the signed-in active administrator profile; callers cannot choose another school ID.
- Administrator Profile logo upload is wired to `school-assets.js` on the feature branch. It uploads to `school-public-assets` and writes the resulting public URL to `schools.logo_url`; the UI also updates its in-memory school logo fields.
- Staff Database photo upload now uses `school-assets.js`, stores the public URL in `school_staff_directory.photo_url`, and preserves an existing photo when no replacement is selected.
- Management profile photos now upload to `school-public-assets`; the profile stores the resulting public URL rather than a base64 data URL.
- Portal news attachments now upload individually to `school-public-assets`; each news record stores public URLs rather than base64 data URLs.
- Prefect photos now upload to `school-public-assets` and the prefect record stores the public URL. This is for photos deliberately published on the public school portal; confirm appropriate school/parent consent before publication.
- The migrated logo, staff, management, news and prefect upload handlers no longer use `FileReader` to encode new images.
- Upload allowlists and limits: JPG, PNG and WebP images up to 5 MB; PDF documents up to 10 MB.
- All object paths begin with the authenticated school UUID.
- Passports and signatures are explicitly prohibited from the public upload helper.

## Important rollout constraints
1. This migration is staged on a feature branch and is not applied to the live database.
2. The new helper is a foundation; Administrator Profile logo, Staff Database photos and management profile photos are integrated on the feature branch. Portal news images, portal staff and prefect photos, student photos and signatures remain to be migrated and verified before browser persistence is retired.
3. The Administrator Profile logo now stores a public URL in `schools.logo_url`. Existing staff photo fields use URLs; each staff workflow must be migrated and public portal rendering verified before cutover.
4. Teacher signatures require a database metadata table keyed by school and subject before moving them out of legacy browser storage. That schema is intentionally not invented in this first Storage bucket migration.
5. Existing browser data and all 14 passport objects (including six unmatched objects) must be preserved until reconciliation and successful cutover.
6. Never put Supabase service-role keys in frontend code. All operations use the authenticated Supabase client and Storage RLS.

## Validation checklist
- Apply migration in a controlled release only after review.
- Inspect resulting bucket settings and Storage policies.
- Test uploads as an administrator in the correct school.
- Verify a different school's administrator cannot upload, read private objects or delete objects under another school folder.
- Verify public objects are only approved assets; never upload passports or signatures to the public bucket.
- Verify signed URLs for private assets expire as expected.
- Integrate and test each legacy upload/read feature before declaring the phase complete.


## Private teacher signature storage foundation (2026-11-08)

A new migration draft, `supabase/migrations/20261108150000_private_teacher_signature_assets.sql`, establishes the metadata and access-control foundation for teacher signatures.

- The `school_teacher_signatures` table stores only the school, subject, private Storage path, uploader and timestamp. It does not store base64 image data or public URLs.
- A unique school-and-subject constraint prevents duplicate active signature records for the same subject in one school.
- Active authenticated users can read signature metadata only for their own school. Only active school administrators can insert, replace or delete metadata.
- A narrowly scoped Storage SELECT policy allows active users to read objects under their own school's `signatures` folder. The existing administrator-only private asset policy remains in place for other private files.
- Signature objects remain in `school-private-assets`; they are not made public.

**Important rollout status:** this is a migration draft committed to the feature branch. It has not been applied to Supabase. The teacher-signature frontend still uses the legacy signature load/save path and must not be considered migrated until it is switched to metadata plus short-lived signed URL resolution and tested in result previews/print output. Do not remove legacy signature data during this transition.

## Student passport and legacy result-photo handling

The dedicated `passport-registration.js` workflow already uses the private `student-passports` bucket, stores object paths in `student_passports`, and issues signed URLs. Keep this as the authoritative passport workflow. The older result-entry and student-register handlers still contain base64 photo handling; they are separate legacy paths and must be reconciled with the passport table before they are changed. Do not bulk-copy or delete legacy images without a read-only match report by student ID/admission number and an explicit verified migration plan.

## Remaining rollout gates

1. Review the live Storage policies and the role values before applying the bucket/signature migrations.
2. Apply the reviewed migrations in Supabase SQL Editor only after confirming the feature release is ready.
3. Implement and test signature metadata loading, signed URL refresh, upload/replace and removal.
4. Confirm signatures display in result preview and print for each authorised school role.
5. Reconcile legacy result-entry passport images against `student_passports`; preserve unmatched files and legacy values until reviewed.
6. Remove operational dependence on browser storage only after every record family has a Supabase table or Storage path, RLS is verified, and round-trip tests pass.
