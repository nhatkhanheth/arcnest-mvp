# ArcNest MVP

ArcNest is a mobile-first shared expense and USDC payment demo. It supports local mock mode, Firebase anonymous auth with Firestore persistence, QR payment payloads, QR invite payloads, and an optional Arc wallet payment path.

## Local Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

The app can run without Firebase or Arc env vars. Missing Firebase env keeps data in local demo storage. Missing Arc payment env keeps payments in mock mode.

## Environment Variables

Copy `.env.example` to `.env` for local development.

Required for production Firebase persistence:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Optional for signed Arc payments. Leave blank to keep mock payment fallback:

```bash
VITE_ARC_RPC_URL=
VITE_ARC_CHAIN_ID=
VITE_ARC_EXPLORER_URL=
VITE_ARC_USDC_ADDRESS=
```

## Firebase Setup

1. Create a Firebase project.
2. Create a Web app and copy the Firebase config values into the `VITE_FIREBASE_*` variables.
3. Enable Authentication.
4. Enable the Anonymous sign-in provider. Firebase docs: https://firebase.google.com/docs/auth/web/anonymous-auth
5. Create a Cloud Firestore database in production mode.
6. Add Firestore security rules for authenticated anonymous users before sharing publicly. Firestore rules docs: https://firebase.google.com/docs/firestore/security/get-started

The app writes these top-level collections:

```text
users/{userId}
users/{userId}/settings/preferences
wallets/{walletId}
groups/{groupId}
groups/{groupId}/members/{memberId}
groups/{groupId}/memberAccess/{userId}
groups/{groupId}/expenses/{expenseId}
groups/{groupId}/payments/{paymentId}
groups/{groupId}/activities/{activityId}
groups/{groupId}/balanceSnapshots/current
invites/{inviteCode}
```

## Demo Seed Data

In development only, open Settings and use `Seed C1K demo data`.

It seeds:

- C1K Tennis group
- 4 members
- 2 expenses
- 1 pending payment
- 1 paid payment
- recent activity

Production does not auto-seed demo data. Create or join a group from the app, or seed only in development.

## Vercel Deployment

Vercel supports Vite projects with `npm run build` and `dist` output. Official docs: https://vercel.com/docs/frameworks/frontend/vite

Dashboard path:

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add all production `VITE_FIREBASE_*` env vars.
7. Add optional `VITE_ARC_*` env vars only when signed Arc payments are ready.
8. Deploy.

CLI path:

```bash
npm run build
npx vercel
npx vercel --prod
```

## GitHub Pages Deployment

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-github-pages.yml`.

For `https://nhatkhanheth.github.io/arcnest-mvp/`, the workflow builds with:

```bash
BASE_PATH=/arcnest-mvp/ npm run build
```

After pushing to `main`, enable Pages:

1. Open GitHub repository settings.
2. Go to `Pages`.
3. Set Source to `GitHub Actions`.
4. Wait for the `Deploy GitHub Pages` workflow to finish.

Do not use Pages source `Deploy from a branch / main / root` for this Vite app. That serves raw source files and causes a blank page.

## Demo Test Checklist

- Open app and confirm anonymous auth starts when Firebase env is present.
- Confirm user profile document is created under `users/{uid}`.
- Create a group.
- Add members.
- Add an expense.
- Confirm balances update.
- Generate payment QR.
- Paste payment QR payload and confirm Payment Sheet opens.
- Generate invite QR.
- Paste invite QR payload and confirm Join Group opens with the invite code.
- Connect wallet, or confirm mock fallback when Arc env is missing.
- Pay a pending balance.
- Confirm payment becomes paid and activity updates.
- Reload the app and confirm data remains.
- Open two tabs and confirm Firebase-backed updates sync.
- Test desktop Chrome.
- Test mobile width 375px, 390px, 414px, and 430px.
- Test iPhone Safari and PWA standalone mode.

## Known MVP Limits

- Camera QR scanning is not implemented yet; paste payload is the demo fallback.
- Arc payments use mock mode until all `VITE_ARC_*` payment settings are configured.
- Wallet recovery, backup, and password flows are placeholders.
- Firestore rules must be hardened for production access control before a public launch.
