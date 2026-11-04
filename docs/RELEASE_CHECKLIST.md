# Release checklist (EAS)

Adapted from the Kotlin `RELEASE_BUILD_GUIDE.md`. Identity: new app, `com.skimaniacs.app` (confirm before first store upload; it cannot be changed afterwards).

## Before every release
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor` all pass
- [ ] `EXPO_PUBLIC_API_URL` in `eas.json` points at the deployed HTTPS API (not example.com)
- [ ] Bump `version` in `app.json` (build numbers are auto-incremented by EAS)
- [ ] API deployed, `/health` OK, JWT secret and Turso token are production values
- [ ] No secrets, keystores or `.env` files committed (EAS manages signing credentials)

## Next steps (backend live, clients not yet switched)
The API runs on Cloud Run (`skimanijaci-api`, `europe-central2`, project `mh-skimanijaci-app`): https://skimanijaci-api-34wbso5laq-lm.a.run.app

- [ ] Commit and push `api/.gcloudignore` and the `api/src/server.ts` env-trim fix
- [ ] Delete the 4 old Cloud Build source archives in `gs://mh-skimanijaci-app_cloudbuild/source/` (they were uploaded before `.gcloudignore` existed and likely contain `api/.env`) and the untagged old images in Artifact Registry
- [ ] Rotate the dev Turso token and dev `JWT_SECRET` that were in `api/.env`
- [ ] Re-save the `turso-database-url` and `turso-auth-token` secrets without a trailing newline (the API now trims, but keep them clean)
- [ ] Confirm the production Turso database has the schema and an active admin account (it is separate from the dev database)
- [ ] Set `ADMIN_API_URL` in `hosting/admin/config.js` to the Cloud Run URL, bump the `admin.js?v=` cache key, and run `firebase deploy --only hosting --project mh-skimanijaci-app`
- [ ] Open `https://mh-skimanijaci-app.web.app/admin/`, log in, and test an offer edit with an image upload (needs the Cloud Run service account to have Storage Object Creator on the bucket, already granted)
- [ ] Replace `https://api-staging.example.com` and `https://api.example.com` in `eas.json` with the Cloud Run URL (or a custom API domain)
- [ ] Add any custom domain to `ALLOWED_ORIGINS` on the Cloud Run service
- [ ] Set a Cloud Billing budget alert on the project and review the `--max-instances=5` cap
- [ ] Decide on rate limiting: limits are per Cloud Run instance, so consider Cloud Armor or a shared limiter before broad launch
- [ ] Build a preview APK and run the device smoke test below against the production API
- [ ] Update `docs/execution_steps.md` (host chosen and deployed; Phase 2/3 items)

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
