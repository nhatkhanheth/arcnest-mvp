# ArcNest MVP

ArcNest is a mobile-first shared expense and USDC payment MVP for public testnet testing. It supports Firebase anonymous auth with Firestore persistence, QR payment payloads, QR invite payloads, demo payment fallback, and an optional Arc testnet wallet payment path.

This repo is not production-safe or mainnet-ready yet. Use testnet only, use a new test wallet, never enter seed phrases or private keys, and do not use real funds.

## Local Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

The app can run without Firebase or Arc env vars for local UI checks. Missing Firebase env keeps writes local to the browser. Missing Arc payment env keeps payments in demo mode.

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
VITE_FIREBASE_MEASUREMENT_ID=
```

Required for Arc testnet USDC transfers. Leave blank to keep demo payment fallback:

```bash
VITE_ARC_RPC_URL=
VITE_ARC_CHAIN_ID=
VITE_ARC_EXPLORER_URL=
VITE_ARC_USDC_ADDRESS=
```

Optional. Enables WalletConnect in addition to injected browser wallets:

```bash
VITE_WALLETCONNECT_PROJECT_ID=
```

## Arc Testnet Payments

ArcNest only signs an onchain payment when all required Arc variables are present at build time. Vite bakes `VITE_*` values into the deployed bundle, so update Vercel environment variables and redeploy after changing them.

To test a real testnet transfer:

1. Set `VITE_ARC_RPC_URL`, `VITE_ARC_CHAIN_ID`, `VITE_ARC_EXPLORER_URL`, and `VITE_ARC_USDC_ADDRESS`.
2. Redeploy the app.
3. Connect a new test wallet on the same Arc testnet chain ID.
4. Make sure the payer wallet shown in the payment sheet matches the connected wallet.
5. Fund the payer wallet with testnet native token and testnet USDC.
6. Confirm a pending payment and approve the USDC transfer in the wallet.

ArcNest never asks for private keys or seed phrases. Wallet connection is external wallet only for this MVP.

## Firebase Setup

1. Create a Firebase project.
2. Create a Web app and copy the Firebase config values into the `VITE_FIREBASE_*` variables.
3. Enable Authentication.
4. Enable the Anonymous sign-in provider. Firebase docs: https://firebase.google.com/docs/auth/web/anonymous-auth
5. Create a Cloud Firestore database in production mode.
6. Add Firestore security rules for authenticated anonymous users before sharing publicly. This repo includes a safer MVP baseline in `firestore.rules`.

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

## Firestore Rules Direction

Do not use `allow read, write: if true;` for public testing. Only use that pattern for a temporary local emulator experiment, never for a deployed Firebase project.

The included `firestore.rules` baseline is intended to enforce:

- signed-in users only
- group members can read group data
- owner/admin can manage members
- permitted roles can create/edit expenses
- payer can update their own payment status
- important records are not hard-deleted

Remaining gaps before real users:

- invite joins need abuse/rate limiting
- role transitions need deeper server-side validation
- payment status should be verified by a backend or Cloud Function
- Firestore rules should be tested with the Firebase Emulator Suite before public traffic

## Demo Seed Data

In development only, open Settings and use `Seed C1K demo data`.

It seeds:

- C1K Tennis group
- 4 members
- 2 expenses
- 1 pending payment
- 1 paid payment
- recent activity

Production does not auto-seed demo data. First public visits start from onboarding and an empty account.

## Vercel Deployment

Vercel supports Vite projects with `npm run build` and `dist` output. Official docs: https://vercel.com/docs/frameworks/frontend/vite

Dashboard path:

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add all production `VITE_FIREBASE_*` env vars.
7. Add `VITE_ARC_RPC_URL`, `VITE_ARC_CHAIN_ID`, `VITE_ARC_EXPLORER_URL`, and `VITE_ARC_USDC_ADDRESS` when Arc testnet payments are ready.
8. Add optional `VITE_WALLETCONNECT_PROJECT_ID` if you want WalletConnect.
9. Deploy.

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

## Public MVP Test Checklist

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
- Connect wallet, or confirm demo fallback when Arc env is missing.
- Pay a pending balance.
- Confirm payment becomes paid and activity updates.
- Reload the app and confirm data remains.
- Open two tabs and confirm Firebase-backed updates sync.
- Test desktop Chrome.
- Test mobile width 375px, 390px, 414px, and 430px.
- Test iPhone Safari and PWA standalone mode.

## Known MVP Limits

- Camera QR scanning is not implemented yet; paste payload is the demo fallback.
- Arc payments use demo mode until `VITE_ARC_RPC_URL`, `VITE_ARC_CHAIN_ID`, `VITE_ARC_EXPLORER_URL`, and `VITE_ARC_USDC_ADDRESS` are configured and the app is redeployed.
- Embedded wallet, import wallet, backup, and passcode flows are coming soon. Do not add seed phrase or private key entry to the client.
- This MVP is not production-safe or mainnet-ready. Add backend payment verification, audited Firestore rules, rate limiting, and abuse controls before real users.
