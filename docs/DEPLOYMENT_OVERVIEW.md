# Deployment Overview

Deployment state verified on 2026-11-04. Secret values are intentionally not included here.

## Live Services

| Component | Current deployment |
| --- | --- |
| Firebase project / Hosting site | `mh-skimanijaci-app` |
| Web app | <https://mh-skimanijaci-app.web.app> |
| Admin panel | <https://mh-skimanijaci-app.web.app/admin/> |
| Delete-account page | <https://mh-skimanijaci-app.web.app/delete-account/> |
| API | <https://skimanijaci-api-1072455253892.europe-central2.run.app> |
| Cloud Run service / region | `skimanijaci-api` / `europe-central2` |

The live app, admin, delete-account, privacy, and terms routes returned HTTP 200 when checked. The API `/health` and `/offers` routes also returned HTTP 200. The API CORS configuration allows the live Hosting origin.

## Temporary Preview

- Preview URL: <https://mh-skimanijaci-app--web-test-eeq3yrcl.web.app>
- Channel: `web-test`
- Scheduled expiration: 2026-11-11
- Preview URLs are public to anyone who has the link.
- The deployed API did not allow this preview origin when checked. Add the exact preview origin to the Cloud Run service's `ALLOWED_ORIGINS` before expecting browser API requests to work from a preview. Remove it when no longer needed.

## Build And Deploy

Run from the repository root in PowerShell. Node is installed at `C:\Program Files\nodejs`; Firebase CLI is invoked through `npx` rather than a global install.

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
$env:NODE_USE_SYSTEM_CA = '1'
$PROJECT_ID = 'mh-skimanijaci-app'
$API_URL = 'https://skimanijaci-api-1072455253892.europe-central2.run.app'
$env:EXPO_PUBLIC_API_URL = $API_URL

.\node_modules\.bin\expo.cmd export --platform web
Copy-Item hosting\admin dist\admin -Recurse -Force
Copy-Item hosting\delete-account dist\delete-account -Recurse -Force

$adminConfig = Get-Content dist\admin\config.js -Raw
$adminConfig = $adminConfig.Replace('http://localhost:8787', $API_URL)
Set-Content dist\admin\config.js -Value $adminConfig -NoNewline

# Temporary preview, expires in seven days.
npx.cmd --yes firebase-tools hosting:channel:deploy web-test --expires 7d --project $PROJECT_ID --config firebase.preview.json

# Publish to the live Hosting channel.
npx.cmd --yes firebase-tools deploy --only hosting --project $PROJECT_ID --config firebase.preview.json --non-interactive
```

Authenticate the CLI when needed with `npx.cmd --yes firebase-tools login`. `firebase.preview.json` serves the combined Expo build and admin from `dist`; it is used for preview and live deployments. The existing `firebase.json` still serves only `hosting/` and is not the config used by the current web deployment.

## API And Database Configuration

- `EXPO_PUBLIC_API_URL` is embedded in the Expo web build at export time.
- The deployed admin URL is set in `dist/admin/config.js` during staging. The source file `hosting/admin/config.js` intentionally remains set to `http://localhost:8787` for local development.
- Cloud Run reads `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `JWT_SECRET` from Secret Manager. Never put their values in Git, web assets, or this document.
- To identify the production Turso database branch, inspect the Cloud Run `TURSO_DATABASE_URL` secret reference/value and compare its hostname with the Turso database endpoint. The local `api/.env` does not identify the production database.
- Preview sites are public. Use the live API only when the data and access behavior are appropriate for testing.

## Notes

- `docs/API_DEPLOYMENT.md` describes API deployment prerequisites and commands. Its example region is `us-central1`; the current deployed API is in `europe-central2`.
- For this Windows environment, `NODE_USE_SYSTEM_CA=1` lets Node use the system certificate store. Do not disable TLS certificate verification to work around certificate errors.
- Verify that the development Turso token and JWT secret exposed during earlier local troubleshooting have been rotated and the old credentials revoked.