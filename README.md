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
