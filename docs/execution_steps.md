# React Native Rebuild — Execution Steps

Use this checklist alongside [REACT_NATIVE_REBUILD_PLAN.md](./REACT_NATIVE_REBUILD_PLAN.md). Execute phases in order and do not pass a phase until its exit criteria are met. The rebuild plan remains the authority for product behavior, API details, and parity requirements.

## 0. Preflight and source access

- [x] Confirm the React Native destination before implementation. The user chose the existing Expo workspace, `C:\Code\SkiManiacs`, rather than the separate `skimanijaci-rn/` destination in the plan. This is an intentional deviation; do not create a second project.
- [x] Keep the Android project read-only. Its source is available in the sibling folder `C:\Code\SkiManijaci\`; the plan's Kotlin source tree, `docs\USER_GUIDE.md`, `docs\RELEASE_BUILD_GUIDE.md`, both CSV files, and `app\src\main\assets\db-scripts\create_tables.sql` are present there. Pre-existing status at preflight: `docs\USER_GUIDE.md` modified; `docs\ACCOUNT_MANAGEMENT_GUIDE.md` and `docs\REACT_NATIVE_REBUILD_PLAN.md` untracked. Preserve these changes and do not treat them as this rebuild's work.
- [x] Verify `C:\Code\SkiManijaci\app\src\main\java\com\skimanijaci\app\` is reachable and use it as the behavior reference. Read the specific Kotlin, resource, and schema files called out by the plan before porting their rules; no behavior comparison has been done yet.
- [x] Enforce the security boundary: never copy credentials, signing material, user data, or password hashes into the React Native project, logs, tests, or commits. The mobile app must use the backend API, not direct Turso credentials.
- [x] Record D6 (backend): keep using the existing Turso database behind a new backend API. The user confirmed the same database should be used; this is not a request to move or replace the database. The mobile app must not connect directly to Turso.
- [x] Record D8 direction (existing-user password compatibility): the user wants both apps to run in parallel and to keep using the existing hashes. Reuse the existing `users.password` column and PBKDF2-HMAC-SHA256 format while both apps are active; do not add a second password-hash column, force resets, or silently rehash. Android reads and writes `password` explicitly (`data\TursoUserFavoritesSyncDataSource.kt`) and verifies PBKDF2-HMAC-SHA256 with 120,000 iterations, a 16-byte salt, a 256-bit derived key, and `Base64(salt):Base64(hash)` encoding (`util\PasswordHasher.kt`). A second hash column would not stay synchronized when either app changes a password, unless both clients were updated to coordinate it. Before implementing auth, verify actual stored formats without exposing credential values and ensure the API can verify the existing hash format. Password changes through either app must remain usable in the other. The Android verifier also accepts plaintext for unrecognized values; assess legacy records carefully and do not copy this fallback into the API without an explicit security decision. Keep all hash verification server-side for the new app; never return hashes to it. This differs from the plan's proposed Argon2/bcrypt contract. A stronger hash migration can be reconsidered after the old app is updated or retired, with an explicit compatibility plan. The old Android app's direct Turso access and on-device hash handling remain a security limitation during parallel operation. Ask about D7 (admin approach) before Phase 4.
- [x] Record the selected project destination and decisions. Phase 0 rule checks use Android's strict integer parsing for available places (`toIntOrNull`); deeper rule-by-rule comparison continues as later phases port those behaviors.

## Phase 0 — Foundations

- [x] Confirm the existing Expo + TypeScript project, strict mode, and SDK-compatible dependencies.
- [x] Set up ESLint, Prettier, Jest, React Native Testing Library, and CI checks for lint, typecheck, and tests.
- [x] Implement typed domain models and pure functions for availability, past offers, date/price sorting, price formatting, localization fallback, filtering, and email/password validation.
- [x] Add unit tests for the ported business rules, guest/member filtering, and API role/field boundaries.
- [x] Add a typed API client and local mock/fixtures covering the API contract. Fixtures follow the Android sample offer CSV structure; no user data or credentials were copied. CSV import is explicitly stubbed with HTTP 501 until Phase 4.
- [x] Add Serbian/English localization, light/dark theme tokens, TanStack Query/Zustand foundations, and a role-aware Expo Router drawer/stack shell.
- [x] Verify: app renders an empty offers screen; domain/API/UI tests pass; lint, typecheck, Expo Doctor, and web export pass. CI workflow is configured but its remote GitHub run is pending.
- [x] Review dependency audit: `npm audit --omit=dev` reports 3 high-severity transitive advisories in the Expo dependency tree; npm's suggested forced fix would downgrade Expo to SDK 51, so no forced dependency changes were made.
- [x] Record deviations and decisions in the rebuild plan and this checklist.

## Phase 1 — Guest MVP

- [x] Build the localized offers list with image carousel, loading/error/empty states, refresh, and offline-cache fallback.
- [x] Build offer details with image pager, localized content, membership-required message, and verified call link.
- [x] Implement date/category/location filters, active-filter chips, clear actions, and persisted Serbian/English switching.
- [x] Add Contacts, Terms and Conditions, and Privacy Policy screens in both languages. Verify any social links with the user before adding them.
- [x] Verify the guest API response contains no price, availability, places, or application-deadline fields; verify these fields are also absent from guest UI.
- [ ] Verify all guest business rules with tests (done: 28 passing) and manually run on iOS and Android simulators (pending, not yet done).
- [x] Report phase results and update the parity checklist.

## Phase 2 — Signed-in users

- [x] Implement login/logout, secure token storage, token refresh, inactive-user rejection, and localized credential/server errors.
- [x] Add signed-in offer price, availability, available places, and application deadline.
- [x] Add price and availability filters, favorites-only filtering, and date/price sorting.
- [x] Implement optimistic favorites, local persistence, startup/login sync, guest login prompt, and the Favorites screen.
- [x] Implement My Account profile updates, password changes, validation, duplicate-field errors, and confirmed account deletion.
- [x] Test all signed-in rules, token expiry, and account deletion end to end.
- [ ] Report phase results and update the parity checklist.

## Backend API (`api\`) — runs alongside the app phases

- [x] Inspect the Turso schema on the dev branch (read-only); all users have PBKDF2 hashes, favorites use the username, offer ids are integers.
- [x] Build the Hono/Node API in `api\` with login, stateless refresh, offers (guest fields stripped server-side), profile, delete account, and favorites. Existing PBKDF2 hashes are verified; the plaintext fallback is not copied. Tokens are stateless JWTs (15 min access, 30 day refresh); active status is re-checked on every request.
- [x] Tests: 17 API tests on an in-memory libsql database, plus an end-to-end run with a temporary user against the dev Turso branch (cleaned up afterwards).
- [x] Add the app's `HttpApiClient`, selected by `EXPO_PUBLIC_API_URL` (mock otherwise). `PATCH /me` returns fresh tokens because they carry the username.
- [x] Login rate limiting (10 failures / 15 min per IP, also on current-password checks), global 300 req/min per IP, JSON request logging without bodies/queries/tokens, security headers, 413 on oversized bodies. `TRUST_PROXY=true` is required behind Cloud Run/Firebase so the real client IP (last X-Forwarded-For entry) is used. Limits are per instance (in memory).
- [ ] Choose the host (Firebase or Cloudflare Workers), deploy to staging, then production; rotate the dev Turso token.
- [ ] Test the app on a device against the staging API, and verify the Kotlin app still works on the same database.
- [x] Admin endpoints: `POST/PUT/DELETE /offers`, `POST /offers/import`, `GET/POST/PATCH/DELETE /users`; admin-only (401 guest, 403 member) - verified on the real dev Turso branch with temporary users.

## Phase 3 — Release hardening

- [x] Error boundary (localized fallback with retry, logging-only `reportError`). Accessibility: labels/roles on the fallback; a full audit of labels is still open. Crash reporting: skipped by decision.
- [x] Analytics decision: none.
- [x] Release checks ported to `docs\RELEASE_CHECKLIST.md`; icon, adaptive icon, splash and favicon generated from `ski.png` (512px source, white on navy).
- [x] EAS profiles (`eas.json`), `app.json` identity (`com.skimaniacs.app`, placeholder pending confirmation), splash config.
- [x] Decisions: package id `com.skimaniacs.app` confirmed; D7 = admin as a web panel (Phase 4); API host = Firebase; store submission postponed.
- [x] Static privacy policy (generated from `src\content\legal.json` by `scripts\build-legal-pages.mjs`) and account-deletion page in `hosting\`, configured for Firebase Hosting (`firebase.json`). Not yet deployed (`firebase deploy --only hosting`).
- [ ] Data-safety declarations and store listing text (postponed with store submission).
- [x] Accessibility audit: card/chip/star labels, 44-48dp touch targets, WCAG AA contrast (tested), carousel image N/M labels, localized detail header. Dynamic type: no `allowFontScaling=false`, no fixed text heights. Screen-reader and large-font checks on a real device are still open (see release checklist).
- [ ] Run the complete regression checklist and smoke-test physical devices.
- [ ] Build release candidates for both platforms. Do not mark the phase complete until all regression items are checked.

## Phase 4 — Admin (D7 decided: web panel, not in the mobile app)

- [x] Offer create/edit/delete in the web admin panel (`hosting\admin`): SR/EN fields, up to 5 image URLs (first is cover), price/currency/Coming Soon, places, deadline. Image upload is not built (no storage chosen; URLs only).
- [x] CSV import in Android column order. Deviation: rows are upserted on (title_sr, startDate) so re-imports update instead of duplicating (Android always inserted new ids); reports inserted/updated/failed; never deletes; priceAmount may be empty when Coming Soon is true.
- [x] User management (list, create, edit, password reset, activate/deactivate, delete). Admins cannot demote, deactivate, rename or delete themselves. Admin-only UI is the web panel, so the mobile menu has no admin items by design (D7).
- [x] Non-admin tokens rejected on all admin endpoints (automated tests plus real-backend run).
- [ ] Report phase results and update the admin parity checklist (plan section 9) - pending your review.

## Data migration — separately approved operation

- [ ] Keep using the existing Turso database; no offer/user/favorite database migration is planned.
- [ ] Inspect the Android schema before implementing the API. Preserve the existing password column and hash format while both apps run.
- [ ] Get approval before any schema change; test additive changes on a copy and document rollback steps before production work.
- [ ] Move images and rewrite URLs only if storage is changed with user approval.

## Completion

- [ ] All relevant parity checklist items in the rebuild plan are checked.
- [ ] Lint, typecheck, tests, CI, and required platform builds pass.
- [ ] Final report lists work completed, tests run, deviations, remaining OPEN decisions, and migration status.
