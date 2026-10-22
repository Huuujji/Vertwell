# P3 authentication — October 17, 2026

**October 22 Task 1:** shared public-login protection is implemented, the additive
nineteenth migration is applied with explicit approval, and local/native/hosted
checks pass. See [LOGIN_PROTECTION.md](LOGIN_PROTECTION.md). This supersedes the
per-process-only login limit in the historical P3 endpoint description below.
Actual Vercel ingress activation/verification stays in the final deployment phase.

**October 22 Task 3:** Auth token checks/password exchanges and current-profile
reads are bounded at five seconds each. Provider outages/timeouts/throttling
return generic service-unavailable responses, while genuinely invalid sessions
remain 401. Structured request correlation and Owner-only read probes are
documented in [OPERATIONS.md](OPERATIONS.md). No actual account, password,
recovery email, hosted Auth setting or migration was changed by Task 3.

**Current development scope (October 21, 2026):** P1–P9 and the newest frontend-priority implementation are complete within their recorded scopes on DualCounter, with eighteen immutable applied migrations and checkout enabled. The application now requires an account; old preview references and phase-specific counts below are historical. The Project Manager selected the seven final recommendations; see [release readiness and current acceptance](RELEASE_READINESS.md), [frontend-priority contract](FRONTEND_PRIORITY.md) and [HandsOff.md](../../HandsOff.md) for current evidence, browser permission and remaining dependencies. Keep the sample QR; actual shop QR/payment trial remains deferred. GitHub release/public deployment is not yet complete.

Real authentication/account lifecycle is implemented and live-tested in the
development project now named **DualCounter** (`izdemgzdywtxhvgvsian`). The project
reference/API URL is unchanged; organization/repository remain Vertwell.
**P3 acceptance is complete:** hosted settings are approved/configured, email
receipt is confirmed, and the user confirmed a successful same-browser password
change and Huuujji login. The new password was entered privately by the user.
P4 business permissions are accepted after explicit exact-project approval,
hosted application and passing verification. P5 Users/Inventory is now accepted
with real browser/Auth/API/Storage checks; CRUD.md and HandsOff.md record the
nine applied sources, two additional user-requested active Admin/Staff accounts,
unchanged Owners and precise coverage. See [AUTHORIZATION.md](AUTHORIZATION.md).
Backend work stays local.

## Runtime and temporary Owner

Ignored `backend/.env` holds the existing project URL, publishable key and
`SUPABASE_SECRET_KEY`. The secret is server-only, used for Auth administration and
service-only username lookup. Ignored `Frontend/.env.local` contains only the URL
and publishable key. Database administration credentials remain separate in
`backend/.env.database.local`; request handlers never use that connection.

`npm run dev` provides real email/username login and the separate P5 management
workspace when its new database commands are available. Real identities never enter sample business data.
The explicitly labeled **Open preview** remains available after logout. Auth
changes clear preview identity/cart/navigation context. SDK session restoration,
refresh/logout/cross-tab events, focus and 60-second profile revalidation are
handled. Errors close authenticated content and offer explicit retry/logout.

The requested temporary Owner exists: **admin / @admin / admin@gmail.com**, ID
`e84626ab-c64f-4945-b978-1cd743fcd954`. Its supplied password is managed by Auth,
never copied into source/profiles/handoff. Recovery verification restored that
password and verified it afterward. No preview person became a real account.
**Keep this admin account active and unchanged.** The user explicitly corrected
the earlier replacement plan. The additional user-approved **Huuujji** Owner,
ID `601ce4ed-8c72-49ed-83e0-294c3cdba2b4`, is for testing only. Its requested
name/email were provisioned through trusted Auth administration and the existing
transactional profile/audit trigger. Its password was passed to a transient process
and Auth, never saved in files. Real email/username API login, role/restoration,
browser login/refresh/logout and unchanged admin were verified. There are exactly
two Auth users/profiles and no sales/stock movements. Do not deactivate or replace
either account based on the historical replacement instructions.
Self-deactivation and removing/demoting the last active
Owner are blocked. Hard profile deletion remains blocked by the history guard.

## Protected account operations

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/login` | Public password exchange; username resolves through a service-only function. Generic credential errors, bounded per-process IP attempts, no cached response. Only active profiles receive an application session. |
| `GET /api/auth/me` | Auth `getUser(token)` plus caller-scoped `current_profile()` returns verified ID/email and active profile/role. |
| `POST /api/auth/accounts` | Owner creates all roles; Admin creates Staff; Staff denied. Operator-supplied password creation, no invitation/email sent. |
| `PATCH /api/auth/accounts/:id` | Owner manages permitted profiles/roles/active state; Admin manages Staff; Staff denied. Requires current `updatedAt`; rejects unsupported fields, self-deactivation and last-Owner loss. |

Auth administration sets trusted `raw_app_meta_data.vertwell_provision`. The
trigger processes INSERT and app-metadata UPDATE events and creates the profile
and audit in Auth's transaction. It rechecks the current active actor/role under
an advisory lock. Public `user_metadata` cannot grant application access. Existing
profiles ignore stale provisioning metadata. Profile PATCH uses `auth.uid()` and
an empty-search-path security-definer command with explicit fields/revisions.
P5 adds the scoped account/email list, Users UI and idempotent provisioning receipts.
Email remains read-only in Manage and creation sends no invitation email; see CRUD.md.

Two immutable applied migrations add the account boundary:

- `20261017030000_authentication.sql`: account serialization/protections,
  provisioning and restricted RPCs.
- `20261017033000_auth_provisioning_events.sql`: handles actual hosted Auth
  metadata timing and prevents provisioning replay from rewriting a profile.

The initial bootstrap exposed GoTrue applying app metadata after Auth INSERT,
leaving an Auth-only identity. The follow-up migration and explicit trusted
bootstrap repair fixed that exact account and verified login/profile. Subsequent
real duplicate-profile provisioning rolls back Auth without residue. No applied
SQL was edited. No extra real accounts, catalogue fixtures or sales were seeded.

At P3 acceptance, all 25 tables retained RLS with zero direct application-role
grants and three restricted account RPC grants: `authenticated` executes
`current_profile()`/`update_account(...)`, and `service_role` executes
`account_login_email(text)`. The now-applied P4 migration adds scoped SELECT
grants/policies, five public RPCs and one private role helper; see AUTHORIZATION.md.
P4 verification confirms both real Auth/profile accounts and settings are unchanged.
Account commands already enforce
their narrower permissions; the service key never replaces caller-scoped access.

## Recovery and configured development Auth

The browser uses PKCE and requests `/auth/callback` on its own origin. The callback
explicitly exchanges the one-time code with `exchangeCodeForSession`, requires its
matching SDK `PASSWORD_RECOVERY` event, then verifies the active profile before
presenting new/confirm password fields. Automatic URL exchange is disabled:
Supabase can retain an earlier session after an invalid code, and that session
must never serve as recovery proof. StrictMode replay shares one exchange;
`sb_flow_id` selects its own verifier. Empty/error callbacks, expired exchanges,
missing verifiers and sign-in codes fail with scrubbed URLs.
`updateUser({password})` changes the real Auth password, then
globally signs out. Invalid/expired callbacks report an error and scrub their URL.
Sample code `123456` exists only when Supabase is unconfigured.

The user explicitly approved the following settings for project
`izdemgzdywtxhvgvsian`, including its `main PRODUCTION` dashboard label. They are
saved and dashboard-verified:

1. Public signup disabled for owner-managed provisioning.
2. Site URL `http://localhost:5173`.
3. Exact allowed redirect `http://localhost:5173/auth/callback`.

A reset was requested for Huuujji from the in-app browser and the user confirmed
email receipt. The initial opened link reported invalid/expired. PKCE needs the
same browser storage that requested the link. After requesting a fresh reset at
`http://localhost:5173` in the browser used to open email, the user confirmed both
password change and Huuujji login worked. That emailed round trip is user-verified,
not an agent capture from the user's regular browser. The user entered/submitted
the new password privately. Emailed recovery is accepted. For future tests, use a
fresh same-browser request. No recovery email was sent to admin@gmail.com.

## Verification and trusted administration

Current verification: **50/50** root checks, **13/13** affected Auth/login browser
cases (22.6s) and **10/10** live testing-account checks pass. All five invalid-link
regressions reproduced before the fix and pass afterward. Typechecks/builds and
schema `--check` pass; all five applied SQL sources and restricted grants remain
unchanged. The prior 223-case broad run is historical, not a new full-suite result.

`npm test` includes PostgreSQL account/migration tests, mocked API checks and
frontend session races. Browser `authentication.spec.ts` uses the actual SDK
with controlled transports for profile routing, restore/logout, access denial,
PKCE password PUT and expired callbacks. Preview tests ignore local credentials.
Controlled transports are not evidence of real email delivery.

`npm run auth:verify --workspace backend -- --project-ref izdemgzdywtxhvgvsian`
reads private `VERTWELL_OWNER_EMAIL/USERNAME/PASSWORD` environment variables. It
verifies live username login, active profile/restoration, invalid credentials and
tokens, account protections, failed provisioning rollback and its own session
logout. It never attempts a real Owner demotion; last-Owner mutation checks belong
to the disposable PostgreSQL suite. Password verification is skipped by default.
With `--allow-password-change`, it also tests recovery/password change and global
logout. Its recovery token comes from Auth administration;
**no email is sent**. It temporarily changes the development Owner password and
restores/verifies the supplied password in cleanup. Use a development test window.
Do not add `--allow-password-change` for the user's testing account without
explicit authorization for that password-change/restore window. Passwords/tokens/provider
objects are never logged. Restoration failure requires
operator attention and must not be represented as a passing test.

`npm run auth:bootstrap --workspace backend -- --project-ref ...` reads private
`VERTWELL_OWNER_NAME/USERNAME/EMAIL/PASSWORD` variables. Existing profiles block
bootstrap. Its explicit `--repair-user-id` option accepts only the matching trusted
bootstrap identity; it does not overwrite another person's account.

References: [Auth user data](https://supabase.com/docs/guides/auth/managing-user-data),
[password recovery](https://supabase.com/docs/guides/auth/passwords),
[sessions](https://supabase.com/docs/guides/auth/sessions),
[sign out](https://supabase.com/docs/guides/auth/signout).
