# DemoOs

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

Start emulator:

```bash
firebase emulators:start --only firestore,functions,auth
```

Use another bash terminal run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/(home)/page.tsx`. The page auto-updates as you edit the file.
