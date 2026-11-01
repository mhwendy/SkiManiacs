# Release checklist (EAS)

Adapted from the Kotlin `RELEASE_BUILD_GUIDE.md`. Identity: new app, `com.skimaniacs.app` (confirm before first store upload; it cannot be changed afterwards).

## Before every release
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor` all pass
- [ ] `EXPO_PUBLIC_API_URL` in `eas.json` points at the deployed HTTPS API (not example.com)
- [ ] Bump `version` in `app.json` (build numbers are auto-incremented by EAS)
- [ ] API deployed, `/health` OK, JWT secret and Turso token are production values
- [ ] No secrets, keystores or `.env` files committed (EAS manages signing credentials)

## Build and submit
- Preview APK: `npx eas-cli@latest build -p android --profile preview`
- Production: `npx eas-cli@latest build -p all --profile production`
- Submit: `npx eas-cli@latest submit -p android` / `-p ios`
- Verify the installed build: version, icon, splash, launches offline-tolerant, login works.

## Store requirements
- Google Play: Data safety form, privacy policy URL, account-deletion URL (in-app deletion exists under My Account).
- App Store: privacy labels, privacy policy URL, Apple Developer account (paid).
- Data collected: username, name, email, favorites. No analytics, no ads, no crash reporting. HTTPS in transit.

## Device smoke test (Android + iOS)
1. Fresh install shows splash then offers list (guest: no price/availability/PAST).
2. Switch language SR/EN from drawer.
3. Log in: price, availability, filters, sort and favorites appear.
4. Star an offer, kill app, reopen: favorite persists; sync after reconnect.
5. Edit profile, change password, log out, log back in.
6. Delete a test account.
7. Airplane mode: friendly "server unreachable" message, no crash.
8. Large system font and dark mode: no clipped text.
