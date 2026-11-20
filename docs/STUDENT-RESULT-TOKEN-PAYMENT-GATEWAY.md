# Student Result Token Payment Gateway

## Scope

This phase enables Paystack payments for student result-check tokens only. ID-card printing payments are intentionally excluded and must remain disabled until separately approved.

## Student token rules

- Price: NGN 651.99 (65,199 kobo).
- Each successful purchase grants exactly five result checks.
- A token is permanently scoped to one school, student, academic session and term.
- First, Second and Third Term balances are separate, including across academic sessions.
- Tokens do not expire. No scheduled expiry, term rollover, session rollover or automatic reset is permitted.
- Unused checks remain available indefinitely for the exact session and term purchased.
- Multiple purchases for the same session and term add five checks each to that term's balance.
- A check deducts exactly one use from the selected term only.
- A payment for one term cannot fund a different term.
- ID-card payment is not implemented in this phase.

## Flow

1. The authenticated student opens Student Results and selects a released academic session and term.
2. The page calls `student-results-portal` in `mode=list`. This returns released session/term choices and the token balance for each pair; it does not return marks and does not consume a token.
3. The student clicks CHECK RESULT. The same endpoint is called in `mode=check` with the selected session, term and a UUID request key.
4. The server verifies the student's account, school, term-specific release stage and approved/published result rows.
5. If the selected term has no remaining checks, the endpoint returns `payment_required`. The page offers Paystack checkout for NGN 651.99.
6. `student-result-token-initialize` validates the authenticated student and selected released term, writes a pending purchase to Supabase, and initializes a fixed 65,199-kobo Paystack transaction.
7. Paystack returns to the student portal. `student-result-token-verify` independently verifies the transaction reference, exact amount, currency and success status with Paystack.
8. Only a verified successful payment is credited. The database RPC credits five checks exactly once to the purchased session/term balance.
9. The original result check is resumed. One check is consumed atomically, and the selected result is returned.
10. Paystack's signed webhook independently re-verifies successful charges and uses the same idempotent credit RPC. Duplicate verification or webhook delivery cannot credit the same purchase twice.

## Database objects

Migration: `supabase/migrations/20261120120000_student_result_term_tokens.sql`

- `student_result_token_balances`: current and lifetime purchased checks per student/session/term.
- `student_result_token_purchases`: Paystack references, fixed price, status, paid time and credit time.
- `student_result_token_events`: append-only purchase-credit and result-check events.
- `credit_student_result_token_purchase(text)`: service-role-only, idempotent purchase credit.
- `consume_student_result_token(uuid, uuid, uuid, uuid, uuid)`: service-role-only, atomic and request-key-idempotent debit.

The tables have RLS enabled and no grants for `anon` or `authenticated`. The RPC functions use invoker security and are executable only by `service_role`. No token expiry column or expiry job exists.

## Edge Functions

- `student-results-portal`: lists released term choices and balances, or consumes a term-specific token before returning results.
- `student-result-token-initialize`: authenticated Paystack checkout initialization.
- `student-result-token-verify`: authenticated server-side Paystack transaction verification and token credit.
- `student-result-token-webhook`: validates Paystack HMAC-SHA512 against the raw request body, independently verifies the charge, then credits once.

The webhook is the only new function configured with `verify_jwt = false`; its Paystack signature is validated in the function. The other functions require JWT authentication.

## Required Supabase secrets

Configure these in the DE-GLOBAL-E-RESULT Supabase project's Edge Function secrets. Do not put secret values in the browser, GitHub source, or chat.

- `PAYSTACK_SECRET_KEY`: the appropriate Paystack secret key for the environment to be used.
- `APP_ORIGIN`: the exact HTTPS origin serving the student portal, e.g. `https://your-school-domain.example` (origin only; no path or trailing slash).

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or publishable key) and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

The same Paystack environment must be used for initialization, verification and webhook configuration. A secret configured in a separate Paystack test project is not automatically available to this school Supabase project.

## Paystack webhook

After deploying the webhook, configure the Paystack dashboard webhook URL:

```
https://rvmcqvfuioxmbtvgdptb.supabase.co/functions/v1/student-result-token-webhook
```

Use the same Paystack environment as `PAYSTACK_SECRET_KEY`. Do not expose or commit the secret key.

## Deployment

The repository's `.github/workflows/supabase-deploy.yml` is a manual deployment workflow. After the secrets above are configured:

1. Open GitHub Actions → Supabase deployment (manual).
2. Run with `deploy_database = yes` and `deploy_edge_functions = yes`.
3. The workflow links the configured production project, previews pending migrations, applies migrations, and deploys every function under `supabase/functions`.
4. Confirm the migration appears in Supabase migration history and the four functions are active.
5. Configure the Paystack webhook URL in the Paystack dashboard.
6. Test with a controlled payment before announcing availability to students.

Do not announce the gateway as live until database migration, Edge Function deployment, secrets and webhook are all configured and verified.

## Verification checklist

- [ ] Token tables and RPCs exist in the production database.
- [ ] Student portal lists only released session/term combinations.
- [ ] A zero-balance term prompts for NGN 651.99.
- [ ] A successful Paystack payment credits exactly five checks to the selected term.
- [ ] A failed, abandoned, mismatched or unverified payment credits zero checks.
- [ ] Repeated verify calls and duplicate webhook events do not credit twice.
- [ ] A check deducts one use from the selected term only.
- [ ] A token in one term cannot be used in another term.
- [ ] A remaining balance is still usable after many years; no expiry is applied.
- [ ] The student can see the remaining balance after every check.
- [ ] Direct calls to the result endpoint cannot retrieve marks without a valid term token.
- [ ] ID-card payment remains unavailable.
