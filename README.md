# DemoOS

---

This repo hosts

- next.js app: the next js fullstack app.

## Getting Started

First, install the dependencies:

```bash
cd polkassembly-v2

nvm install 22
nvm use 22

yarn install --frozen-lockfile

npm install -g firebase-tools
firebase --version
```

## Environment Setup (.env)

Create root env file:

```bash
cp .env.example .env.local 2>/dev/null || touch .env.local
```

Use at least the following values in `.env.local`:

```bash
# DemoOS feature flags
ENABLE_BLOCKCHAIN=false

# App defaults
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_DEFAULT_NETWORK=polkadot

# Algolia (used by browser + Next.js API routes)
NEXT_PUBLIC_ALGOLIA_APP_ID=YOUR_ALGOLIA_APP_ID
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=YOUR_ALGOLIA_SEARCH_ONLY_KEY
ALGOLIA_WRITE_API_KEY=YOUR_ALGOLIA_WRITE_API_KEY
```

Create Functions env file:

```bash
touch functions/.env
```

Use at least the following values in `functions/.env`:

```bash
# Algolia (used by Firebase Functions)
ALGOLIA_APP_ID=YOUR_ALGOLIA_APP_ID
ALGOLIA_WRITE_API_KEY=YOUR_ALGOLIA_WRITE_API_KEY
```

Notes:

- `NEXT_PUBLIC_ALGOLIA_APP_ID` and `ALGOLIA_APP_ID` should normally be the same value.
- Restart both Next.js dev server and Firebase emulators after changing env files.

Then, login Firebase:

```bash
firebase login
firebase use --add
```

Third, initiate Firebase emulator:

```bash
firebase init emulators
```

Choose at least the following emulators:

```bash
- Firestore Emulator
- Functions Emulator
- Auth Emulator
- Emulator UI
```

Fourth, build Firebase Functions (required before starting the emulator):

The Functions emulator loads `functions/lib/index.js`, which is compiled from TypeScript sources in `functions/src/`. You must build before starting the emulator:

```bash
cd functions && npm install && npm run build && cd ..
```

To automatically rebuild on every source change, run in a separate terminal:

```bash
cd functions && npm run build:watch
```

Start emulator:

```bash
firebase emulators:start --only firestore,functions,auth
```

> **Note:** If you see `functions/lib/index.js does not exist, can't deploy Cloud Functions`, run `cd functions && npm run build` to compile the TypeScript sources.

Use another bash terminal run the development server:

```bash
npm run dev
# or
yarn dev
```

## Algolia Setup Guide

This project uses:

- `polkassembly_v2_posts` index for posts/discussions
- `polkassembly_v2_users` index for users

For `polkassembly_v2_posts`, configure these facet/filter attributes in Algolia Dashboard:

- `network` (required for network-level filtering)
- `proposalType` (required for tabs: referenda/discussions/bounties/other)
- `topic` (used by topic filter)
- `tags` (used by tag filter)
- `origin` (used by track filter)

Recommended searchable fields:

- `title`
- `parsedContent`

Discussion navigation requirement:

- Post records must include `documentId` (Firestore Document ID).
- Search result click uses this `documentId` to open `/discussions/{documentId}`.

If old records were indexed before `documentId` was added, reindex posts so search results can route correctly.

Quick verification checklist:

1. Create a new discussion in local app.
2. Confirm a record appears in `polkassembly_v2_posts` with `documentId` populated.
3. Search for the discussion title.
4. Click result and verify it opens `/discussions/{documentId}` (not numeric index).

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/(home)/page.tsx`. The page auto-updates as you edit the file.

## Firebase App Hosting Deployment & Full-Stack Troubleshooting Guide

This project is built with **Next.js** and hosted on **Firebase App Hosting** (powered by Google Cloud Run). Because the project combines complex frontend rendering with Serverless backend logic, you may encounter a series of cloud environment configurations, permission issues, and security policy restrictions during the initial deployment.

Below is a complete record of our deployment troubleshooting, solutions, and key takeaways for future developers.

### 1. Backend Authentication: Ditching Private Keys for ADC (Application Default Credentials)

- **Issue:** After deployment, the backend crashed immediately when trying to connect to Firestore, logging `FIREBASE_SERVICE_ACC_CONFIG is not set`.
- **Root Cause:** The source code expects a JSON private key for Firebase Admin SDK initialization. However, manually managing private keys in Firebase App Hosting is neither secure nor elegant.
- **Solution:**
  1. Modify the initialization code to use Google Cloud's native ADC mechanism for automatic, keyless authentication:
     ```typescript
     // Before: Forced key check
     firebaseAdmin.initializeApp({ credential: ... });
     // After: Call initialization without arguments in production to activate ADC
     } else if (!firebaseAdmin.apps.length) {
         firebaseAdmin.initializeApp();
         console.log('ℹ️ Firebase Admin initialised using ADC.');
     }
     ```
  2. **Crucial Permission:** Go to the Google Cloud Console (IAM & Admin), locate the service account named `Firebase App Hosting Compute Service Agent`, and manually add the **"Cloud Datastore User"** role. Without this, ADC does not have permission to read the database by default.

### 2. Missing Environment Variables

- **Issue:** Catching the actual backend stack trace revealed an API 500 error caused by: `Error: TOOLS_PASSPHRASE is not defined in environment variables`.
- **Root Cause:** The project's cryptography dependencies require a passphrase for initialization. Missing this variable in a fresh cloud environment directly halts the process.
- **Solution:** In the Firebase Console's App Hosting environment variables settings, add `TOOLS_PASSPHRASE` and assign it a strong, randomly generated 32-character string (without quotes).

### 3. Database Performance Protection: Missing Firestore Composite Index

- **Issue:** Opening a specific author's post list triggered a backend error: `FAILED_PRECONDITION: The query requires an index.`
- **Root Cause:** Firestore strictly enforces that any query combining "conditional filtering" and "sorting" (e.g., `where("authorUid", "==", uid)` combined with `orderBy("createdAt", "desc")`) must have a pre-built composite index. Otherwise, the query is rejected.
- **Solution:** Go to Firebase Console -> Firestore Database -> Indexes -> Composite, and manually add the following rule:
  - **Collection ID**: `posts`
  - **Field 1**: `authorUid` (Ascending)
  - **Field 2**: `createdAt` (Descending)
  - **Query Scope**: Collection

### 4. Frontend Security Defense: CSP Blocking Rich Text Rendering

- **Issue:** Post details existed in the database, but the frontend still showed a pink 404 page. The browser console showed a red error: `Content Security Policy of your site blocks the use of 'eval'`.
- **Root Cause:** Third-party libraries used by Polkassembly (like Markdown parsers or Web3 SDKs) quietly use dynamic script execution (`eval`) under the hood. The project's extremely strict CSP headers blocked the rendering process, causing Next.js to fallback to the 404 page.
- **Solution:** Modify `next.config.mjs` in the root directory. Explicitly add `'unsafe-eval'` to the `script-src` directive of the `Content-Security-Policy`:
  ```javascript
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://...";
  ```

### 5. The "Ghost Bug": Next.js ISR & CDN Caching

- **Issue:** After fixing all the database, permission, and code issues above, accessing the page **still resulted in a 404**. However, after waiting a few days (or a short period), the page magically started working.
- **Root Cause:** This is caused by Next.js's ISR (Incremental Static Regeneration) and "stubborn caching" behavior. When the system previously failed, it generated a 404 page and aggressively cached it in the cloud CDN. Even after the backend was fixed, the frontend continued to serve the cached 404 until its TTL expired (or the instance cold-started).
- **Solution (For future reference):** When debugging Next.js production environments, if you confirm the backend and data are fixed but the frontend still errors out, try using URL parameters like `?_rsc=` to bypass the cache, clear browser caches, or trigger API endpoints to force cache invalidation (Revalidate). Do not blindly modify the code.

---

### Core Best Practices

1. **Separate Frontend and Backend Logging Visions:**
   When a Next.js page throws a 404 or 500, the browser's F12 Network panel only shows the surface. You **must** go to Google Cloud's **Logs Explorer** and search for the specific URL path or the unique `Trace ID` to catch the real `TypeError` or database rejection logs thrown by the Node.js backend.
2. **Beware of GCP's "Principle of Least Privilege":**
   In Serverless environments (Cloud Run / App Hosting), never assume that code deployed on your own platform naturally has access to your own database. All backend read/write access to storage services must be explicitly authorized in GCP's IAM.
3. **Embrace Data Schema Constraints:**
   Polkassembly is designed for multi-chain environments and strongly relies on fields like `network: "polkadot"`. Due to legacy reasons, some APIs are extremely strict about the type of the `id` field (string vs. number). When maintaining and testing the database, ensure internal document fields highly conform to the expected schema.
