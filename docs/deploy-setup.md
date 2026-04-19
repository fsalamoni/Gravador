# Gravador — Deploy Setup Guide

## Prerequisites

- Firebase project `hocapp-44760` with Blaze plan (required for Cloud Run, Artifact Registry, and Hosting rewrites)
- GitHub repository with push access
- Node.js 22+, pnpm 10+

---

## 1. GitHub Secrets (Required for CI/CD)

Go to **GitHub → Settings → Secrets and variables → Actions → Secrets** and add:

### Deploy Secrets

| Secret | Description | How to get |
|--------|-------------|------------|
| `FIREBASE_SERVICE_ACCOUNT` | Service account key JSON | Firebase Console → Project Settings → Service accounts → Generate new private key |
| `FIREBASE_PROJECT_ID` | `hocapp-44760` | Firebase Console → Project Settings → General |

### Build Secrets (NEXT_PUBLIC — baked into JS at build time)

| Secret | Description | How to get |
|--------|-------------|------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web API Key | Firebase Console → Project Settings → General → Your apps → Web app → Config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `hocapp-44760.firebaseapp.com` | Same as above |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `hocapp-44760` | Same as above |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `hocapp-44760.firebasestorage.app` | Same as above |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID number | Same as above |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:XXXXX:web:XXXXX` | Same as above |
| `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` | `anotes` | Dedicated Firestore database used only by Gravador |

### Optional Runtime Secrets

Add these only if you use the corresponding features in production:

| Secret | Description |
|--------|-------------|
| `INTERNAL_WEBHOOK_SECRET` | Signature expected by `/api/webhooks/recording-uploaded` |
| `OPENAI_API_KEY` | OpenAI-backed AI pipelines |
| `ANTHROPIC_API_KEY` | Anthropic-backed AI pipelines |
| `GROQ_API_KEY` | Groq-backed AI pipelines |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google-backed AI pipelines |

### Where to find the Firebase config values

1. Go to [Firebase Console](https://console.firebase.google.com/project/hocapp-44760/settings/general)
2. Scroll down to **Your apps** section
3. If no Web app exists, click **Add app** → **Web** → Register
4. Copy the `firebaseConfig` values

---

## 2. Firebase Console Setup

### Firestore Database
- Use the named database `anotes` (not the default database and not `psico`)
- Current region in Firebase/GCP: **southamerica-east1**
- Deploy rules: `firebase deploy --only firestore:rules`

### Firebase Authentication
- Enable **Google** provider and keep it as the supported platform sign-in method
- Add authorized domains: `anotes.web.app` and any localhost domain you use for validation
- Validate that `/login` completes Google sign-in and that `/workspace` redirects there when unauthenticated

### Firebase Storage
- Default bucket should exist
- Deploy rules: `firebase deploy --only storage`

### Firebase Hosting
- Ensure the Hosting site `anotes` exists in Firebase Hosting
- The repository is configured to deploy explicitly to `anotes.web.app`
- Hosting proxies application traffic to the Cloud Run service `anotes-web` in `us-central1`
- Verify at Firebase Console → Hosting

### Cloud Run
- Deploy the web container as the Cloud Run service `anotes-web`
- Runtime service account: `hocapp-44760@appspot.gserviceaccount.com`
- Region: `us-central1`
- Container port: `3000`
- Artifact Registry repository: `gravador-web`
- Runtime envs: `NEXT_PUBLIC_APP_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIRESTORE_DATABASE_ID`, plus any optional AI/webhook secrets you actually use
- Optional runtime env: `ANDROID_PREVIEW_URL` to expose the current Android APK on `https://anotes.web.app/download`

---

## 3. Local Development

```bash
# Clone and install
pnpm install

# Copy and fill env vars
cp apps/web/.env.example apps/web/.env.local

# Run dev server
pnpm dev
```

---

## 4. Manual Deploy (from local machine)

```bash
# Login to Firebase
firebase login

# Build and publish the web container
gcloud builds submit \
	--project hocapp-44760 \
	--region us-central1 \
	--service-account projects/hocapp-44760/serviceAccounts/hocapp-44760@appspot.gserviceaccount.com \
	--config infra/cloudbuild/web.yaml \
	--substitutions _IMAGE_URI=us-central1-docker.pkg.dev/hocapp-44760/gravador-web/anotes-web,_NEXT_PUBLIC_FIREBASE_API_KEY=...,_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...,_NEXT_PUBLIC_FIREBASE_PROJECT_ID=...,_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...,_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...,_NEXT_PUBLIC_FIREBASE_APP_ID=...,_NEXT_PUBLIC_FIRESTORE_DATABASE_ID=anotes,_NEXT_PUBLIC_APP_URL=https://anotes.web.app \
	.

# Deploy Cloud Run
gcloud run deploy anotes-web \
	--project hocapp-44760 \
	--region us-central1 \
	--image us-central1-docker.pkg.dev/hocapp-44760/gravador-web/anotes-web:latest \
	--service-account hocapp-44760@appspot.gserviceaccount.com \
	--allow-unauthenticated \
	--port 3000 \
	--memory 512Mi \
	--cpu 1 \
	--concurrency 80 \
	--max-instances 10 \
	--set-env-vars NEXT_PUBLIC_APP_URL=https://anotes.web.app,FIREBASE_PROJECT_ID=hocapp-44760,FIREBASE_STORAGE_BUCKET=hocapp-44760.firebasestorage.app,FIRESTORE_DATABASE_ID=anotes

# Deploy Hosting rewrite configuration
pnpm firebase:deploy
```

Notes:
- Local Windows builds do not use `standalone` by default, which avoids symlink permission failures.
- Docker and CI builds opt into standalone output with `NEXT_BUILD_OUTPUT=standalone`.
- This deploy path avoids Firebase Hosting web framework preview and the missing default Compute Engine service account.
- If Artifact Registry repository `gravador-web` does not exist yet, create it once with `gcloud artifacts repositories create gravador-web --repository-format=docker --location=us-central1`.

---

## 5. Mobile App (Expo / EAS)

### Development build (local testing)
```bash
cd apps/mobile
cp .env.example .env
npx expo start --dev-client
```

### Preview build (internal distribution via EAS)
```bash
pnpm mobile:whoami
pnpm mobile:preview
```

Notes:
- The preview profile now produces an Android APK for immediate sideload testing.
- The preview and production profiles target `https://anotes.web.app` and the dedicated Firestore database `anotes`.
- The repository does not depend on a global EAS install anymore for local operator flow; `pnpm mobile:preview` downloads `eas-cli` on demand.
- If you already have a linked Expo project, keep that configuration. If you need deterministic Expo Updates / project linkage in CI, provide `EXPO_PUBLIC_EAS_PROJECT_ID` in the build environment.
- Current web access is Google Auth only; the web session endpoint now rejects non-Google Firebase sign-ins.
- Current mobile access is also Google Auth only; local/dev-client auth is wired with the debug SHA, and EAS build profiles now default to the non-debug Android client id generated from the registered SHA `d1da8de8c1a53582915aea1ddb51f8e5392cf35c`.
- Firebase mobile app registrations created in project `hocapp-44760`:
	- Android app id: `1:143237037612:android:31789e1c4b51e86f031b89`
	- iOS app id: `1:143237037612:ios:775bb62eab513e36031b89`
- Current known OAuth client ids from Firebase:
	- Web: `143237037612-a95vks10tuuaeeab9ekpk0kf4mng06r2.apps.googleusercontent.com`
	- iOS: `143237037612-hc8jrc15e2ibh2vgg5d6uj4a0j7ejb4l.apps.googleusercontent.com`
	- Android debug / local SHA: `143237037612-etj2lbdph46vk6u58taa7hm329fv99sm.apps.googleusercontent.com`
	- Android non-debug / registered SHA `d1da8de8c1a53582915aea1ddb51f8e5392cf35c`: `143237037612-likp7uaelm375jjk2pfg4tpi19r0c91a.apps.googleusercontent.com`

### Production build (store submission)
```bash
cd apps/mobile
eas build --profile production --platform all
eas submit --platform all
```

### EAS Environment Variables
Set these in [Expo Dashboard](https://expo.dev) → Project → Secrets:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIRESTORE_DATABASE_ID` = `anotes`
- `EXPO_PUBLIC_API_URL` = `https://anotes.web.app`
- Optional override: `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- Optional: `EXPO_PUBLIC_EAS_PROJECT_ID` for Expo Updates URL and explicit project linkage

### Android Google OAuth for EAS builds

1. Confirm which non-debug SHA1 fingerprint the Android build is using. The project currently has `d1da8de8c1a53582915aea1ddb51f8e5392cf35c` registered in Firebase.
2. If the signing certificate changes, register the new SHA in Firebase:

```bash
firebase apps:android:sha:create 1:143237037612:android:31789e1c4b51e86f031b89 <sha1>
```

3. Re-download the Android SDK config:

```bash
firebase apps:sdkconfig ANDROID 1:143237037612:android:31789e1c4b51e86f031b89 --project hocapp-44760
```

4. Copy the `oauth_client` entry with `client_type: 1` into `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` for the matching build environment.
5. The repo currently uses `143237037612-likp7uaelm375jjk2pfg4tpi19r0c91a.apps.googleusercontent.com` for EAS-managed Android builds.

---

## 6. CI/CD Workflows

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push/PR | Lint + Typecheck |
| `firebase-hosting.yml` | Push to main | Lint + Typecheck + Deploy Firestore indexes/rules/storage + Wait for indexes + Build container + Deploy Cloud Run + Deploy Hosting rewrite to the `anotes` site |
| `eas-preview.yml` | PR or manual dispatch | Android EAS preview build for internal distribution (requires `EXPO_TOKEN` and optionally `EXPO_PUBLIC_EAS_PROJECT_ID`) |

---

## 7. Merge / Commit / Deploy Flow

1. Create a feature branch from `main`.
2. Open a pull request using the repository PR template.
3. Wait for `CI` to pass.
4. If the PR changes `apps/mobile/**` or shared packages, wait for `EAS preview` and capture the generated artifact URL.
5. Merge into `main` only after validation of web routes and, when relevant, Android preview installability.
6. Let `firebase-hosting.yml` deploy Firestore platform config, wait for composite indexes, then deploy Cloud Run and Hosting.
7. If a new Android preview should be public, update repository variable `ANDROID_PREVIEW_URL` and rerun the web deploy.
8. Smoke test `/api/health` and Google sign-in on `/login` after deploy before declaring the release healthy.

### Rollback

If the web release fails after deployment:
- Find the last known-good Cloud Run image or revision.
- Redeploy it manually with `gcloud run deploy anotes-web --image ...`.
- Confirm `https://anotes.web.app`, `/download`, and `/api/health` return success.
- Re-run the Hosting workflow if needed to republish the latest rewrite state.

### Operational notes

- `firebase-hosting.yml` now writes the ready Cloud Run revision and service URL into the GitHub step summary.
- `firebase-hosting.yml` now deploys Firestore indexes/rules/storage before the web rollout and waits for declared composite indexes to reach `READY`.
- `eas-preview.yml` now writes the Android build ID, details URL, and artifact URL into the GitHub step summary.
- `/api/health` now verifies the Firestore recordings query path used by the live workspace, not just process liveness.
- `ANDROID_PREVIEW_URL` is intentionally a deploy-time runtime variable, so the website can expose a new APK without another code change.
