# Principal Account and Oversight Dashboard

## Purpose
The Principal workspace provides read-only executive oversight of the school's official records. It is integrated into the existing DE-GLOBAL ACADEMY application and reads from the same Supabase database as the Administrator, Form Masters, Subject Teachers and student portal.

## Roles and access
- Only an active School Administrator can create, list, activate, deactivate or reset the Principal account.
- The Principal signs in using the dedicated Principal login option and the email/password provisioned by the Administrator.
- Principal account creation is performed by the `manage-principal-account` Edge Function. The function verifies the authenticated Administrator, binds the account to that Administrator's school, creates the Supabase Auth user and application profile, and generates a temporary password.
- The first-login password change is enforced by the `change-principal-password` Edge Function.
- The Principal workspace is read-only. It does not provide score editing, result approval/publication, user administration or school configuration controls.

## Administrator: create the Principal account
1. Sign in using the School Administrator account.
2. Open **User Management**.
3. In the **Principal Account** panel, enter the Principal's full name, unique school username and email address. Phone is optional.
4. Select **Create Principal Account**.
5. Share the generated temporary password privately with the Principal. Do not post it in a group or public channel.
6. The new account appears in the Principal Account list. Only one Principal profile is allowed per school; use Activate if an existing account is inactive.
7. Use **Reset Password** if the Principal loses access. The new temporary password is displayed once and must be shared privately.

## Principal: first login
1. Select **Principal** in the login type selector.
2. Enter the account email and temporary password.
3. Create a new password of 12–128 characters containing uppercase and lowercase letters, a number and a special character.
4. Confirm the new password. The system updates the Supabase Auth password and clears the first-login requirement.
5. Sign in again with the new password.

## Principal workspace
- **Overview:** school-level student, class, staff, subject and current-term result indicators.
- **Students:** official student register.
- **Staff & Teachers:** school staff directory.
- **Results Monitoring:** draft, submitted, approved and published result-entry status.
- **Academic Reports:** class and subject average summaries based on current session and term results.
- **Requests & Activity:** student record correction requests and recent school audit events.
- **School Profile:** school identity and Principal account details.

The dashboard retrieves records from Supabase when a tab is opened. It does not use local browser storage as a record store. Large result sets are paginated for reporting.

## Security and data flow
The Principal dashboard queries the existing `students`, `classes`, `school_staff_directory`, `subjects`, `results`, `academic_sessions`, `terms`, `student_change_requests`, `school_activity_audit` and `schools` records. Four SELECT-only row-level security policies grant Principal access to school-scoped results, staff, audit events and student correction requests. Existing school-scoped read policies protect the other dashboard sources.

The account-management Edge Function uses the authenticated Administrator identity and server-side Supabase administrative credentials. Administrative secrets are never sent to the browser. Password reset and account activation are also performed server-side.

## Troubleshooting
- **Principal option is missing:** refresh the application after the latest GitHub Pages deployment and confirm the login type list is current.
- **Account already exists:** use the existing account's Activate or Reset Password controls; do not create a duplicate.
- **Invalid credentials:** verify the email address and temporary password with the Administrator.
- **Dashboard says access denied:** confirm the profile is active, has role `principal`, belongs to the correct school and has completed the first-login password change.
- **A tab reports a database error:** check Supabase Edge Function and database logs, then verify the Principal SELECT policies and the table's school_id association.
- **No figures appear:** verify that official school records exist for the selected school and that the academic session and term are configured.

## Verification status
The login wiring, dashboard module syntax, Administrator User Management integration and Supabase function deployments have been checked. A live Principal sign-in and role-based end-to-end test remains pending until the Administrator creates the real Principal account and tests with its credentials.
