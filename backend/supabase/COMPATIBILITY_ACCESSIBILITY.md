# Task 5 — compatibility and accessibility

Follow the newest eleven-task order in `../../HandsOff.md`. Task 5 browser
permission was granted on October 22, 2026 for local checks only. It does not
authorize another numbered task, external documentation, account navigation or
deployment. The Project Manager has an iPhone, Android phone and laptop; physical
coverage is available in principle and has **not** been deferred or verified.

## Automated evidence and its limits

`Frontend/tests/accessibility.spec.ts` uses the existing isolated Express/PGlite
fixture, fake Auth/Storage transports and unchanged migration sources. It checks
login/recovery keyboard order, password visibility state, alert errors, all six
manager destinations, navigation focus trapping/restoration, inventory editor,
payment dialog, information disclosure, selected receipts and discard behavior.
The 1440×900, 640×360 and 320×568 viewports are desktop reflow checks. They are
neither real browser zoom nor physical-device verification. Reduced-motion
emulation does not establish every animation or assistive-technology behavior.

Results belong in HandsOff and the local ignored `.review/task5-20261022/` logs.
The final affected Edge run passes **7/7 in 30.5 seconds** (three new checks plus
four existing dialog regressions); final frontend/integration typechecking passes.
The initial sandbox browser launch failed, and the first permitted run found a
fixture-name selector error; both are recorded accurately in HandsOff. Correcting
that selector required no application change. Twenty viewport captures were
saved; Inventory at 320×568 and payment/review at 640×360 were visually sampled.
Subsequently, native Windows controls set Edge to **200%**, confirmed by Edge's
zoom UI/accessibility text. Sampled navigation, editor, cash payment and review
controls/disclosures/actions were reachable by vertical scrolling, with retained
modal headings and return focus after cancellation. Zoom was restored to **100%**.
Narrator was operated with explicit permission and then stopped; the user's
spoken-audio observations remain pending. This actual browser-zoom evidence is
separate from Windows display scaling, which was not changed or verified.
The subsequent attempt to inspect System Settings was refused by the computer-use
tool because `systemsettings` was not approved for control. The user has been
asked to perform/report that scaling check manually; it remains pending. No
access restriction was bypassed and no Windows scaling preference was changed.
Never label DOM roles/names or Playwright assertions as user-heard Narrator
announcements. No conformance certification or exhaustive accessibility audit is
claimed. Figma comparison and physical printing remain excluded.

## Disposable laptop manual session

The ignored local helper `.review/task5-20261022/manual-session.ts` opens a
separate visible Edge window against the test-owned server on loopback port 5180.
It imports the existing test-server setup with environment loading/proxy disabled.
Its sample users, stock and two pending receipts live only in memory. Close that
Edge window to stop the helper and discard the scratch database. Run only when
port 5180 is free, from the repository root:

```powershell
node --import ./node_modules/tsx/dist/loader.mjs ../.review/task5-20261022/manual-session.ts
```

In **that helper-owned window**, log in with `owner` / `Test-password-123`.
Those are disposable fixture credentials, never shop-account credentials. Opening
the same URL in another browser does not inherit the fixture transports; it is
not a usable phone/Safari/Firefox test endpoint. The helper is a local review aid,
excluded from Git and deployment, rather than a permanent production entry.

Record the actual Windows version, Edge version, screen resolution and display
scaling before testing. Record pass/fail and exact control for each step:

1. Start Narrator with **Windows + Ctrl + Enter**. Use Tab/Shift+Tab, Enter and
   Space through Username or email, Password, Show/Hide password and Log in. Try
   an incorrect sample password once. Report whether field names, visibility
   state and the error are announced. Log in with the fixture password.
2. Use navigation to reach Inventory. Open Add Product, inspect the labeled
   fields and return without saving. At narrow sizes, open the navigation drawer,
   cycle forward/backward and close it with Escape. Report focus and order.
3. In POS, add the sample retail item and open Pay → Cash payment. Inspect Amount
   Given, Back and the payment action. Close without confirming a checkout.
4. In Audit Trail, open Review daily sales. Expand both information disclosures,
   select one receipt and inspect expected/verified/difference amounts. Report
   checkbox announcements and whether the updated selection/totals can be read.
   Press Escape, Keep editing, then Escape and Discard changes. Confirm focus
   returns to the review opener. Do not confirm a review for this observation.
5. Turn Narrator off. Set Edge's **… → Zoom to 200%** and repeat navigation,
   inventory editor, payment and review checks. Report clipped text, unreachable
   controls or page-level sideways scrolling. Table-contained scrolling is
   intentional. Restore browser zoom afterward.
6. Test the chosen Windows display scaling separately and record its actual
   percentage; do not silently change system settings from automation. Repeat
   the same controls and restore the user's preferred setting afterward.

User observations, including “not tested,” are required. Agent assertions cannot
fill the result fields. No actual payment, shop stock write, account change or
history change is necessary.

## Physical phones and additional browsers

Agree a reachable test URL/environment before phone testing. A laptop's
`localhost` URL points to each phone itself, and the managed laptop fixture above
does not provide transports to other browsers/devices. Do not deploy early to
obtain a URL, expose the official database, open firewall rules or assume LAN HTTP
has the same secure-context behavior as the final HTTPS application.

The Project Manager chose **isolated local phone access before proceeding**.
Ignored `.review/task5-20261022/phone-server.mts` now provides a separate private-LAN
HTTPS endpoint on port 5183, using a scratch PGlite database, fake same-origin
Auth/private-update transports, a session-link/cookie gate and Host/Origin/source
restrictions. It does not load development environment files or proxy official
services. The exact current link is in the chat/ignored `phone-server.log`; do not
publish its access value or certificate key. Run from the repository root with
the existing loader only when the port is free:

```powershell
node --import ./node_modules/tsx/dist/loader.mjs ../.review/task5-20261022/phone-server.mts
```

This local review aid requires its generated certificate/key and a current laptop
LAN address; its certificate lasts three days. Both phones must use the same
Wi-Fi. A self-signed local HTTPS warning may need the user's manual decision.
No certificate was installed, no firewall/security setting changed, and no public
tunnel or deployment created. Report connection/certificate errors rather than
calling a failed connection an application compatibility failure. Stop the helper
after testing; it is not a production service.

The final `verify-phone.mts` desktop Edge smoke passes: unauthorized access and
backend-source requests receive 403; secure context/native UUID, sample login,
editor/cancel, cash dialog/cancel and two-receipt review work; zero external
requests/page errors were observed. Initial helper host-guard and simulated-update
issues were corrected and are recorded in HandsOff. This smoke uses an explicit
test-only TLS context and is not evidence that either phone accepted the local
certificate or passed its checks. Actual iPhone Safari/Android Chrome results and
model/OS/browser versions remain pending. Windows Firefox/tablet coverage is
still undecided. Hosted Auth/email/Storage/private-update availability remains
Task 11 verification, distinct from this browser/device fixture.

For each chosen environment, record model/OS/browser/version, portrait and
landscape, login, navigation, inventory editor/cancel, table scrolling, POS
payment/cancel, review/disclosures and exact findings. iPhone Safari, Android
Chrome and Windows Firefox are separate evidence rows. An available device is
not a passing result. Assistive technology on phones is additional chosen scope;
do not infer VoiceOver/TalkBack verification from a touch-browser check.

Task 5 remains partial until agreed manual evidence and findings are resolved or
the Project Manager explicitly records the remaining coverage decision.
