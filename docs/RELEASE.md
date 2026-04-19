# Gravador Release Runbook

## Purpose

This runbook defines the minimum safe path for merge, preview distribution, production deploy, and rollback.

## Branch flow

1. Branch from `main`.
2. Keep each branch scoped to one release concern when possible.
3. Open a pull request and complete the PR template.
4. Do not merge while required checks are red or skipped without justification.

## Required checks

- `CI` for every pull request.
- `EAS preview` whenever the PR touches `apps/mobile/**` or shared packages used by mobile.
- Manual validation of the public web routes and `/api/health` for deploy-affecting changes.

## Web release

1. Merge approved PR into `main`.
2. Wait for `firebase-hosting.yml` to complete. It now deploys Firestore indexes/rules/storage before the web rollout and waits for declared composite indexes to be ready.
3. Confirm the step summary reports the Cloud Run service URL and ready revision.
4. Smoke test:
   - `https://anotes.web.app`
   - `https://anotes.web.app/download`
   - `https://anotes.web.app/api/health`
  - `https://anotes.web.app/login` should present the Google-only sign-in flow and complete successfully
   - `https://anotes.web.app/workspace` should redirect to login when unauthenticated.

## Android preview release

1. Let `EAS preview` complete on the pull request, or trigger it manually via GitHub Actions when remote Expo credentials are available.
2. Copy the artifact URL from the workflow summary.
3. Update repository variable `ANDROID_PREVIEW_URL`.
4. Trigger or re-run `firebase-hosting.yml` so `/download` exposes the latest APK.
5. Install on a real Android device and verify authentication plus one recording upload flow.
6. Confirm the mobile `/auth` screen completes Google sign-in before testing recording.
7. For Android preview/production builds, verify the Firebase Android app has the SHA1 of the active signing certificate registered and that `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` matches the generated `client_type: 1` OAuth client.
8. The repository is currently wired for the registered non-debug SHA `d1da8de8c1a53582915aea1ddb51f8e5392cf35c`, which maps to `143237037612-likp7uaelm375jjk2pfg4tpi19r0c91a.apps.googleusercontent.com`.

## Authentication contract

- Web access is Google Auth only.
- Mobile access is also Google Auth only.
- Firestore for this platform must stay on the dedicated `anotes` database, not `psico` or `(default)`.
- The session exchange route rejects non-Google Firebase ID tokens.
- Firebase Console must keep the Google provider enabled and the live domain authorized before any release.
- Expo environments must provide the public Google OAuth client IDs used by the native preview and production builds, or rely on the preconfigured non-debug Android client id committed in `apps/mobile/eas.json` and `apps/mobile/app.config.js`.

For local operator runs, use:

```bash
pnpm mobile:whoami
pnpm mobile:preview
```

For Firebase platform changes, use:

```bash
pnpm firebase:deploy:platform
pnpm firebase:wait:indexes -- --project hocapp-44760 --database anotes
pnpm firebase:deploy
```

## Rollback

1. Identify the previous known-good Cloud Run image or revision.
2. Redeploy it manually:

```bash
gcloud run deploy anotes-web \
  --project hocapp-44760 \
  --region us-central1 \
  --image us-central1-docker.pkg.dev/hocapp-44760/gravador-web/anotes-web:<known-good-tag>
```

3. Recheck public routes.
4. Re-run Hosting deploy if needed.
5. Document the failure cause before attempting a new release.

## Required repository variables and secrets

- Secrets: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`, required `NEXT_PUBLIC_FIREBASE_*`, optional AI/webhook secrets.
- Variables: `HAS_EXPO_TOKEN=true`, optional `EXPO_PUBLIC_EAS_PROJECT_ID`, optional `ANDROID_PREVIEW_URL`.