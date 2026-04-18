# Gravador — Deploy Setup Guide

## Prerequisites

- Firebase project `hocapp-44760` with Blaze plan (required for Cloud Functions / framework hosting)
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

### Where to find the Firebase config values

1. Go to [Firebase Console](https://console.firebase.google.com/project/hocapp-44760/settings/general)
2. Scroll down to **Your apps** section
3. If no Web app exists, click **Add app** → **Web** → Register
4. Copy the `firebaseConfig` values

---

## 2. Firebase Console Setup

### Firestore Database
- Create a named database called `anotes` (not the default database)
- Set to **us-central1** region
- Deploy rules: `firebase deploy --only firestore:rules`

### Firebase Authentication
- Enable **Email/Password** provider (for magic links)
- Enable **Google** provider
- Add authorized domain: `anotes.web.app`

### Firebase Storage
- Default bucket should exist
- Deploy rules: `firebase deploy --only storage`

### Firebase Hosting
- Ensure the Hosting site `anotes` exists in Firebase Hosting
- The repository is configured to deploy explicitly to `anotes.web.app`
- Verify at Firebase Console → Hosting

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

# Build the web app
pnpm --filter @gravador/web build

# Deploy
pnpm firebase:deploy
```

Notes:
- Local Windows builds do not use `standalone` by default, which avoids symlink permission failures.
- Docker and CI builds can still opt into standalone output with `NEXT_BUILD_OUTPUT=standalone`.

---

## 5. Mobile App (Expo / EAS)

### Development build (local testing)
```bash
cd apps/mobile
npx expo start --dev-client
```

### Preview build (internal distribution via EAS)
```bash
cd apps/mobile
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

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
- `EXPO_PUBLIC_API_URL` = `https://anotes.web.app`

---

## 6. CI/CD Workflows

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push/PR | Lint + Typecheck |
| `firebase-hosting.yml` | Push to main | Lint + Typecheck + Build + Deploy to the `anotes` Hosting site |
| `eas-preview.yml` | PR | EAS Preview build (requires `EXPO_TOKEN` in vars) |
