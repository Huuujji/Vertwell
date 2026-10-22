# Selected final work — October 21, 2026

**October 22 Task 5 resumption:** the user resumed after the Task 4 stop and
granted Task 5 local browser permission only. Targeted Edge checks pass 7/7 in
30.5 seconds and frontend typechecking passes. Actual Edge 200% zoom has since
been sampled through native Windows controls and restored to 100%; Narrator was
operated with permission, but user-heard speech remains unverified. Windows
scaling and physical-device results remain pending. The user has
an iPhone, Android and laptop; these are available devices, not passing results
or an agreed deferral. The user selected isolated local phone access before
proceeding; its disposable HTTPS endpoint is prepared and desktop-smoke verified.
Actual iPhone/Android observations and tablet/Firefox scope still need resolution.
See [COMPATIBILITY_ACCESSIBILITY.md](COMPATIBILITY_ACCESSIBILITY.md)
and the newest HandsOff checkpoint. Do not advance past unresolved Task 5 or
treat the earlier Task 4 stop text below as a new stop instruction.

The Project Manager selected the seven recommendations in HandsOff.md. This is
the operational guide for that selection; the public root README stays unchanged.
**Ask first separately for every numbered task before any browser/website activity,
detail entry or browser tests.** The latest October 22 permission covers Task 5
local Edge/browser checks in the resumed chat only. It does not carry into another
numbered task, future chats or account navigation/deployment. The earlier Task 4
stop has been resumed. The user has a Windows laptop, iPhone and Android; actual
manual results and additional-browser/physical-device coverage remain pending.
Keep the sample QR; the real shop QR/payment trial remains deferred.

**Current order, revised October 21:** follow the newest order in
`../../HandsOff.md`. Finish the selected remaining work and resolve explicit
deferrals, complete final acceptance on the resulting source, then save the
verified release. **Vercel deployment is the last phase.** Hosting/account and
environment planning can be prepared beforehand. Actual platform routing,
live-origin recovery and environment checks occur in that last phase, before
public cutover. The older acceptance results below are a preserved baseline;
recording this order does not run the new final test or authorize deployment.

## Task 1 completed — October 22

Shared public-login protection is implemented and verified, including the
explicitly approved additive nineteenth migration on DualCounter. See
[LOGIN_PROTECTION.md](LOGIN_PROTECTION.md) for trusted client identity, atomic
counter permissions/failure handling, exact evidence and final-phase Vercel
activation checks. Root checks pass 175/175; affected Edge checks pass 17/17;
native independent-connection and rollback-only hosted checks pass. All existing
protected-table fingerprints and eighteen earlier migration sources are preserved.
This is Task 1 verification, not Task 9 final acceptance. The Project Manager
subsequently **deferred all of Task 2 and directed continuation with Task 3**.
The backup policy/operator is agreed, but destination, separate key storage,
actual backups and isolated restore remain unverified. Do not mark it complete.

## Task 3 operational preparation — October 22

The Project Manager is the monitoring operator. [OPERATIONS.md](OPERATIONS.md)
defines private read-only dependency checks, structured error/slow-request records,
bounded client observations, exact-operation checkout reconciliation and response
procedures for Auth, database, Storage and private updates. Source instrumentation
and disposable verification are implemented; no hosted account/paid service,
continuous alert delivery or platform logging setup was performed. Verify the
actual sink, environment and agreed operator workflow in final Task 11.

## Task 4 native follow-up complete; stopped after Task 4 — October 22

[PERFORMANCE_MIXED.md](PERFORMANCE_MIXED.md) records the approved test assumptions,
reproducible fresh-cluster profiler, raw-evidence location and limits. Three
cashiers completed 500 genuine receipts with concurrent mixed Owner reads;
stock/payment/revision reconciliation and twenty exact retries pass. Quote p95
is 22.54 ms, successful checkout p95 188.62 ms and reports p95 1,169.06 ms, within
the agreed native targets. The burst returned 653 explicit revision conflicts;
the driver separately models a fresh review/quote and production never silently
retries writes. Report payload reached 7,696,561 bytes. Larger coherent history,
hosted/network latency and real cashier experience are not established by this
bounded run. No runtime SQL optimization or new migration was made.

Post-Task-4 root checks pass 183/183; root typechecks, both builds and the exact
generated-schema unit comparison pass. All nineteen migration sources, the
public README and older native measurement artifacts are preserved. This is
affected/checkpoint validation, not the Task 9 final browser/manual acceptance.
**Stop here until the user resumes. Next implementation task: Task 5 Windows
compatibility/accessibility, requiring its own browser permission and actual
user-observed Narrator results.** Task 2 stays explicitly deferred and unverified;
the complete selected priority remains incomplete. Vercel remains Task 11, last.

## Previous October 21 acceptance baseline

The application now requires a real account and uses page paths such as `/Login`
and `/Inventory`. Production no longer initializes the old demo workspace. The
default Playwright suite selects ten current regression/component files rather
than running preview-dependent historical cases. Isolated component harnesses
remain test-only; they do not provide production preview access.

From the repository root:

```powershell
npm test
npm run typecheck
npm run build
npm run integration:schema --workspace backend -- --check
npm run test:e2e --workspace Frontend
```

The frontend browser command is **test:e2e**, not `test`. Its own Vite server uses
port 5180, fake Auth/storage transports, a real local Express API and disposable
PGlite SQL databases. It does not use the shop database or actual payment provider.
Root checks pass 129 backend + 38 frontend unit/render checks. Both builds,
typechecks and generated schema consistency pass. **The final isolated current
browser suite passes 66/66 in one 3.1-minute run, with no failures/skips.** Its
server avoids the development proxy/config/environment and rejects any unrouted
API request with 503; a direct request verifies rejection. The 276 historical
preview tests are not a current acceptance count. Root deployment entry typing is
included in `npm run typecheck`; the ES-module entry's local health/JSON-404/401
smoke check passes. This does not verify Vercel platform routing/build.

Production dependency audit on October 21 returned zero reported vulnerabilities
(`npm audit --omit=dev`). This is a point-in-time dependency result, not a security
certification. The frontend build reports a main JavaScript chunk above 500 kB;
first-load optimization remains a measured follow-up rather than a build failure.

## FP1 findings and operational decisions

| Area | Evidence / remaining release requirement |
| --- | --- |
| Roles and writes | Current unit/API/SQL checks cover caller-scoped permissions, inactive accounts, exact retries, stale revisions, transaction rollback, usable stock and receipt preservation. No migration rewrite or hosted sales reset is part of this task. |
| Secrets | Server `SUPABASE_SECRET_KEY` is used for account provisioning/username lookup; it must never be a `VITE_*` variable. The browser rejects a privileged Supabase key. `.vercelignore` excludes local environment files and review artifacts. Never copy credentials into this guide, HandsOff or a PR. |
| Public login | Task 1 now supplies a shared, service-only atomic database counter, canonical socket/Vercel client identity and closed failure behavior. Local/native/hosted verification passes; the actual Vercel ingress and environment verification remains in Task 11. See `LOGIN_PROTECTION.md`. |
| Recovery | The app uses PKCE at `/auth/callback`. Supabase Auth Site URL and allowed redirects must include the actual chosen application origin and its `/auth/callback` path. A production email delivery/recovery trial and its operator remain pending until the URL/mail setup exists. |
| Health | Public `/api/health` remains liveness. Owner-only `/api/health/ready` executes bounded Auth/profile, caller-scoped SQL and private Storage-listing reads. It explicitly leaves private updates/receipt reconciliation to their actual evidence. This is not an end-to-end recovery or every-image delivery test. |
| Monitoring / recovery | Project Manager is operator; structured request/error/slow signals and a recovery guide are implemented. Actual platform collection/retention and live verification belong to final hosting activation. Task 2 backups/isolated restore are explicitly deferred; no disaster-recovery readiness is claimed. |
| Data environments | The Project Manager explicitly selected the current DualCounter Supabase database for this deployment. Preserve its existing accounts/catalogue/settings/stock/history. Preview access, backup policy and release cutover still need concrete settings. Preview tests must not create business transactions in it. |
| Acceptance boundary | Local SQL/API/browser coverage cannot establish production Auth email delivery, Vercel routing/environment values, native mobile compatibility, a real payment or operational recovery. |

## FP5 native PostgreSQL measurements

The profiler is `backend/scripts/profile-native.ts`; it does not import dotenv or
the hosted development database helper. It rejects nonlocal URLs, database names
outside `vertwell_fp5_*`, pre-existing application data/functions/schemas and a
cluster containing other application databases or Supabase roles. It creates only
test-owned Auth/Realtime stand-ins, then applies the unchanged migration sources.

On Windows, use an existing native PostgreSQL binaries directory:

```powershell
.\backend\scripts\profile-native.ps1 -PgBin 'C:\path\to\pgsql\bin'
```

The wrapper creates a unique cluster under ignored `.review/fp5-native`, chooses a
free loopback port, binds only 127.0.0.1, runs the checks, stops that cluster in
`finally`, and retains files for inspection. It installs no Windows service and
does not delete an existing cluster. Its trust authentication is for this isolated
local fixture only. Never use it as deployment configuration.

The October 21 run used PostgreSQL 18.6 on Windows x64, Node 24.18.0, 16 logical
CPUs and 15.82 GiB RAM. The portable archive came from
[EDB's binary distribution](https://www.enterprisedb.com/download-postgresql-binaries)
and matched the distributor's SHA-256 sidecar. No browser or root test suite was
running during the successful measurement. All eighteen migrations were applied
to the new scratch database. The server was stopped after the run.

Eight clients competing for one usable item produced one committed receipt and
seven explicit conflicts, with no oversell. Eight simultaneous exact retries
returned one receipt, seven replays and one stock deduction. Four connections,
twenty attempts and one-/five-line baskets each committed five receipts and
returned fifteen explicit stale-revision conflicts. Their stock/receipt counts
reconciled; no write was silently retried. These cases share a cashier/stock and
intentionally contend on the existing global revision.

P12's synthetic detector workload was continued with three cashiers, twenty
configurations, one line/two modifiers per synthetic receipt and ten-minute
spacing, plus a genuine qualifying five-checkout burst. Each case was warmed and
timed three times. The affected burst's identity/revision remained unchanged.

| Synthetic history size | Median affected-cashier detection | Median all-cashier detection |
| --- | --- | --- |
| 1,000 | 41.43 ms | 125.55 ms |
| 5,000 | 195.14 ms | 612.92 ms |
| 20,000 | 809.90 ms | 2,373.17 ms |

Raw measurements and `EXPLAIN (ANALYZE, BUFFERS)` plans are retained in ignored
`.review/fp5-native/result.json` and `plans.json`. These are **local native SQL**
results, with test-owned Auth/Realtime; they are not hosted API throughput or a
production SLA. Synthetic projections do not represent stock/payment
reconciliation. The bounded real checkout contention and synthetic large-history
detection measurements are separate cases. At that October 21 checkpoint, shop
workload/latency targets had not been supplied. The October 22 follow-up above
now tests explicitly approved assumptions, not measured shop usage. Before
high-volume use, evaluate canonical-signature storage or a
maintained projection against a representative mixed workload. Any optimization
must preserve grouping/window/read identity and use a new additive migration.

## FP6 Windows compatibility and accessibility

Microsoft Edge 155.0.4283.62 is available. The current suite covers responsive
viewports, keyboard dialogs/navigation, retained drafts, focus, errors and read
markers. A desktop browser at phone width is still a desktop browser. No physical
phone/tablet, Safari, Firefox or real screen-reader acceptance is established.

For an actual Windows Narrator check, turn it on with **Windows + Ctrl + Enter**.
Use Tab/Shift+Tab and Enter through login, navigation, one inventory editor, POS
payment, the daily-review checkboxes/totals and an information disclosure. Check
that names, roles, errors and focus are announced in a useful order; Escape should
close dialogs or open the appropriate discard confirmation. Check Windows display
scaling and browser zoom at 200%. Record browser version, result and exact failing
control. The user performs the Narrator observation; an agent cannot infer what
the user heard. Figma comparison and physical-print verification remain excluded.

## FP4 sample QR

Keep the accepted sample. The real shop QR scan, actual received payment,
reference entry and receipt check require the actual image and the user's trial.
No provider API is required and no payment is performed by this work. The user's
QR path instruction remains chat-only; do not add its location to this document.

## FP2 source and release preparation

At review start, `Backend/Backend_Phase` was at `f22bf5f`, tracking
`origin/Backend_Phase`. `main` was at `90a6704`. Numerous October 21 source/test/doc
changes already existed. Preserve them. No commit, push, PR, merge or production
release has been performed by this final-work checkpoint.

After acceptance, review the complete working diff and secret/artifact exclusions,
save a source commit, and use a reviewed PR from the development branch to the
intended release branch. Confirm the actual branch/remote state again before a
mutation. The user still needs to choose the release destination and live cutover;
an outdated local branch is not sufficient evidence to merge. Do not put ignored
backups, environment files, portable binaries or test output into Git.

## FP3 single Vercel project preparation

Frontend and backend can work under one project and origin. Root `vercel.json`
builds the npm workspaces, serves `Frontend/dist`, routes `/api/*` to the shared
`api/index.ts` Express entry, and sends other application deep links to
`index.html`. The existing `Frontend/vercel.json` is the older frontend-only
configuration; the proposed unified project must use the **repository root** as
its Vercel Root Directory. Local `npm run dev` remains the two development servers
connected by Vite's `/api` proxy.

This preparation follows Vercel's [Node function entry guidance](https://vercel.com/docs/functions/runtimes/node-js)
and [rewrite configuration](https://vercel.com/docs/project-configuration/vercel-json).
Platform build/routing is not verified by a local TypeScript check. Confirm it in
a protected preview before publication. No Vercel project/account is linked yet.

| Setting | Proposed value / source |
| --- | --- |
| Root Directory | Repository root, not `Frontend` or `backend` |
| Node | 24.x, consistent with repository engines |
| Install / Build / Output | `npm ci` / `npm run build` / `Frontend/dist` |
| `VITE_API_BASE_URL` | Leave empty; browser calls same-origin `/api` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | The selected Supabase project's public connection values |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Same selected Supabase project, server runtime variables |
| `SUPABASE_SECRET_KEY` | Server runtime only, entered through the chosen secure environment flow |
| `CORS_ORIGINS` | Exact approved application origins; no wildcard. Add protected preview origins only deliberately. |
| Supabase Auth | Actual Site URL plus approved `/auth/callback` redirect URLs |

The Project Manager chose the existing Supabase database and is creating a first
Vercel account. Give signup instructions before project import/deployment. Vercel's
[Hobby documentation](https://vercel.com/docs/plans/hobby) limits that plan to
non-commercial personal use; choose the appropriate plan before live shop use,
without starting an unselected paid subscription.

Missing before deployment: the user's Vercel account/team/project, final app URL,
hosting plan, release branch, secure environment values, final Vercel activation
verification of the implemented login protection, and recovery/backup/monitoring
decisions. Do not invent them.
Do not add provider secrets to frontend variables. With target settings agreed,
build a protected preview, check `/api/health`, deep-link refresh and assets, real
account login/role/recovery, private updates and saved data. Any actual business
write/payment trial needs its chosen scope. After those checks, present the exact
preview/commit/environment for the user's final publication decision. Rollback
the application to the prior reviewed deployment if necessary; do not reverse
applied database sources or replay the completed sales reset.
