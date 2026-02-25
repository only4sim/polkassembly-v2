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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/(home)/page.tsx`. The page auto-updates as you edit the file.
