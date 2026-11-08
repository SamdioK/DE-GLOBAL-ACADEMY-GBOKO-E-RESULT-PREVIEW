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
- These three integrated upload handlers no longer use `FileReader` to encode new logo/staff/management images.
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
