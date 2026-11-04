# Firebase and Cloud Run Deployment

The recommended production layout is Firebase Hosting for the admin panel and legal pages, with the Hono API deployed as a public Cloud Run service in the same Google Cloud project. The API remains responsible for JWT authentication and admin authorization.

## Prerequisites

- A Firebase project linked to a Google Cloud project, with billing enabled.
- Cloud Run, Cloud Build, Artifact Registry, Secret Manager, and Cloud Storage APIs enabled.
- A production Turso database/token. Do not deploy the local development database token.
- The Firebase Storage bucket `mh-skimanijaci-app.firebasestorage.app` (or update `FIREBASE_STORAGE_BUCKET` if using another bucket).
- A Cloud Run service account with `roles/secretmanager.secretAccessor` on the API secrets and `roles/storage.objectCreator` on the image bucket.

Create these Secret Manager secrets and add their production values through the Google Cloud Console:

- `turso-database-url`
- `turso-auth-token`
- `jwt-secret` (at least 32 characters; generate a new production secret)

Do not put secret values in Git, the browser, or `hosting/admin/config.js`.

## Build and Deploy the API

From the repository root, set your project and region in PowerShell:

```powershell
$PROJECT_ID = "your-firebase-project-id"
$REGION = "us-central1"
$REPOSITORY = "containers"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/skimaniacs-api:latest"
```

Create the Artifact Registry repository once, then build the API image:

```powershell
gcloud artifacts repositories create $REPOSITORY --repository-format=docker --location=$REGION --project=$PROJECT_ID
gcloud builds submit --tag=$IMAGE api
```

Create a dedicated service account and grant it access to the three secrets and Storage bucket as described above. Then deploy, supplying the secret names and non-secret settings:

```powershell
gcloud run deploy skimanijaci-api `
  --image=$IMAGE `
  --project=$PROJECT_ID `
  --region=$REGION `
  --port=8080 `
  --allow-unauthenticated `
  --service-account="skimaniacs-api@$PROJECT_ID.iam.gserviceaccount.com" `
  --set-secrets="TURSO_DATABASE_URL=turso-database-url:latest,TURSO_AUTH_TOKEN=turso-auth-token:latest,JWT_SECRET=jwt-secret:latest" `
  --set-env-vars="^;^NODE_ENV=production;FIREBASE_STORAGE_BUCKET=mh-skimanijaci-app.firebasestorage.app;TRUST_PROXY=true;ALLOWED_ORIGINS=https://$PROJECT_ID.web.app,https://$PROJECT_ID.firebaseapp.com"
```

Add any custom Hosting domain to `ALLOWED_ORIGINS` as another comma-separated origin. Cloud Run provides `PORT`; the container listens on port 8080. `--allow-unauthenticated` is needed for guest offers and login; protected API routes still require valid JWTs, and admin routes additionally require an active admin account.

Check the service URL and health endpoint:

```powershell
$API_URL = gcloud run services describe skimanijaci-api --project=$PROJECT_ID --region=$REGION --format="value(status.url)"
curl.exe "$API_URL/health"
curl.exe "$API_URL/offers"
```

## Deploy Firebase Hosting

Update `hosting/admin/config.js` so `window.ADMIN_API_URL` is the Cloud Run service URL, then deploy the static admin panel and legal pages:

```powershell
firebase deploy --only hosting --project $PROJECT_ID
```

The admin page will be at `https://$PROJECT_ID.web.app/admin/`. Use the same Cloud Run URL for `EXPO_PUBLIC_API_URL` in the EAS environment before building the mobile apps. The web app origin must be included in `ALLOWED_ORIGINS`.

## Storage and Runtime Notes

- Local uploads use Google Application Default Credentials. Run `gcloud auth application-default login` as a developer with Storage Object Creator access; do not download a service-account key into the repository.
- Cloud Run uses its attached service account for Firebase Storage uploads. Download-token URLs are returned to the admin form and saved in the offer's existing image URL fields.
- The API rate limiters are in-memory and apply per Cloud Run instance. For stronger distributed rate limiting, add a shared limiter or edge protection before broad public launch.
- Cloud Run scales independently of Hosting. Monitor logs and usage, set budget alerts, and rotate any development credentials before production deployment.