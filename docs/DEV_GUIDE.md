下面给你两部分内容：

# DemoOS Development Guide (Local Dev, Emulators, Build, Run, Debug)

> This guide helps new developers set up DemoOS from scratch: install dependencies, configure Firebase Emulator Suite, build Cloud Functions, run Next.js, and debug common issues.
>
> DemoOS is based on a fork of `polkassembly-v2` (Next.js App Router) but migrates blockchain-dependent operations to Firebase (Firestore + Cloud Functions). The MVP focuses on:
>
> - Email/Password Auth
> - Posts + Comments
> - Multi-select voting (one-person-one-vote, pointsBalance as eligibility gate)
> - Moderation (pin/lock/hide)

---

## 0. Prerequisites

### Required

- Node.js (project uses Node 22 in `functions/engines.node`)
- Yarn (recommended by upstream setup patterns)
- Firebase CLI (`firebase-tools`) (required for emulators and deployments)
- Java (required by Emulator Suite; Firebase docs list Java/JDK requirements)

### Recommended

- VS Code Desktop (especially if using GitHub Codespaces) — browser-based Codespaces has limitations for some emulator access patterns.

---

## 1. Repository Setup

### 1.1 Clone and install

```bash
git clone <your-fork-url>
cd <repo-root>
yarn install --frozen-lockfile
```

### 1.2 (Optional) No-Keys Dev Mode / Feature Flags

DemoOS aims to run without blockchain keys for MVP. Some legacy pages/features may be disabled via feature flags to avoid startup/build issues.

---

## 2. Firebase Emulator Suite Setup

### 2.1 Install Firebase CLI

```bash
npm install -g firebase-tools
firebase --version
```

Firebase CLI is the standard tool to run emulators and deploy Firebase services. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

### 2.2 Initialize emulators (first time only)

From the repo root:

```bash
firebase init emulators
```

Select at least:

- Authentication Emulator
- Firestore Emulator
- Functions Emulator
- Emulator UI

Firebase documents typical emulator ports and how to configure them in `firebase.json`. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

### 2.3 Ensure `firebase.json` exists (repo root)

The emulator relies on `firebase.json`. If it’s missing, the CLI will “use defaults” and may not know where your Functions source lives. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

A minimal example (adjust paths if your repo differs):

```json
{
	"functions": [
		{
			"source": "functions",
			"codebase": "default"
		}
	],
	"firestore": {
		"rules": "firestore.rules",
		"indexes": "firestore.indexes.json"
	},
	"emulators": {
		"auth": { "port": 9099 },
		"functions": { "port": 5001 },
		"firestore": { "port": 8080 },
		"ui": { "enabled": true, "port": 4000 },
		"singleProjectMode": true
	}
}
```

> Default ports (commonly used): UI 4000, Functions 5001, Firestore 8080, Auth 9099. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

### 2.4 Firestore rules file (recommended)

If `firestore.rules` is not specified, Firestore emulator defaults to allowing all reads/writes. You should always create and point to a rules file for safe development. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

Create `firestore.rules` (minimal safe starter; expand later for posts/comments/votes/admin):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

---

## 3. Cloud Functions: Build & Run with Emulator

### 3.1 Install function dependencies

```bash
cd functions
yarn install
```

### 3.2 Build functions (TypeScript -> lib)

Your `functions/package.json` uses:

- `"build": "tsc"`
- `"main": "lib/index.js"`

Build:

```bash
yarn build
```

Check output exists:

```bash
ls -la lib/index.js
```

### 3.3 Start emulators (recommended: long-running dev)

Open terminal A (repo root):

```bash
firebase emulators:start --only firestore,functions,auth
```

Firebase docs confirm Functions emulator can emulate HTTPS + callable functions locally. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

### 3.4 Notes on credentials for local functions

For Firestore-triggered functions, emulation generally works without extra credentials. If your functions call non-emulated Google/Firebase APIs, you may need `GOOGLE_APPLICATION_CREDENTIALS`. Firebase explains this in local Functions emulator guidance.

---

## 4. Next.js App: Run & Connect to Emulators

### 4.1 Start Next.js dev server

Open terminal B (repo root):

```bash
yarn dev
```

### 4.2 Connect Firebase JS SDK to emulators (client-side)

When running in development, the app should point Auth/Firestore/Functions to local emulators.

Use Firebase’s docs for connecting apps to emulators:

- Firestore emulator connection guidance and demo-project behavior [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/connect_firestore)
- Functions emulator connection guidance [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/connect_functions)

Example pattern (place in your Firebase initialization module; adjust to your codebase):

```ts
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

if (process.env.NODE_ENV === 'development') {
	connectAuthEmulator(auth, 'http://localhost:9099');
	connectFirestoreEmulator(db, 'localhost', 8080);
	connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

(Reference implementations are widely documented; see emulator connection guidance above.) [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/connect_firestore), [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/connect_functions)

---

## 5. Testing: Emulator-Driven Repeatable Runs

### 5.1 Why `emulators:exec`?

`firebase emulators:exec` is designed to:

- start emulators,
- run a script,
- shut down emulators.
  This is ideal for tests/CI.

### 5.2 Example test command

From repo root:

```bash
firebase emulators:exec --only firestore,functions,auth "yarn test"
```

[\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

> Do NOT use `emulators:exec` to run `yarn dev` because `dev` is a long-running process; use `emulators:start` + `yarn dev` in two terminals instead. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

---

## 6. Deployment (Firebase Hosting + Functions)

### 6.1 Next.js on Firebase Hosting

Firebase CLI supports deploying Next.js apps; SSR/dynamic logic can be deployed to Cloud Functions depending on configuration and usage.

### 6.2 GitHub integration for preview/prod deploy

Firebase provides GitHub integration that can create preview URLs for PRs and deploy on merge.

---

## 7. GitHub Codespaces Notes (If Applicable)

### 7.1 Port forwarding behavior

Codespaces supports port forwarding and port visibility settings (private/org/public), but organization policies may restrict public exposure. [\[docs.github.com\]](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace), [\[docs.github.com\]](https://docs.github.com/en/codespaces/managing-codespaces-for-your-organization/restricting-the-visibility-of-forwarded-ports)

### 7.2 Browser-based Codespaces limitations

Using only the browser IDE can limit how certain emulator HTTP endpoints are accessed. Switching to VS Code Desktop is a reliable workaround. [\[github.com\]](https://github.com/orgs/community/discussions/42879)

---

## 8. Common Troubleshooting

### 8.1 Functions emulator won’t start: “codebase source must be specified”

Cause: `firebase.json` not found (wrong working directory) or missing `functions.source`.
Fix:

1.  Run `firebase emulators:start` from repo root (where `firebase.json` exists), or
2.  Add correct `functions.source` in `firebase.json`. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

### 8.2 Firestore emulator: “did not find rules file; default allow all”

Cause: `firestore.rules` not specified in `firebase.json`.
Fix: Create `firestore.rules` and point to it from `firebase.json`. [\[firebase.google.com\]](https://firebase.google.com/docs/emulator-suite/install_and_configure)

### 8.3 Hydration mismatch in Next.js (dev console warnings/errors)

Hydration mismatch can happen when server-rendered HTML differs from the client’s initial render. Causes include browser extensions modifying HTML and client-only branches. Next.js documents common causes and remedies.  
A very common source is extensions like Grammarly adding attributes (e.g., `data-gr-ext-installed`) causing mismatch; disabling/uninstalling the extension fixes it. [\[nextjs.org\]](https://nextjs.org/docs/messages/react-hydration-error) [\[stackoverflow.com\]](https://stackoverflow.com/questions/75337953/what-causes-nextjs-warning-extra-attributes-from-the-server-data-new-gr-c-s-c)

---

## 9. DemoOS MVP Rules (Quick Reference)

### 9.1 Voting

- Multi-select voting is supported.
- Results are one-person-one-vote (each user counts once).
- `pointsBalance` is an eligibility gate only (e.g., must be >= 1 to vote).

### 9.2 Admin

- Admin is created by manually setting Firestore:
  - `users/{uid}.role = "admin"`

### 9.3 Disabled legacy features

- Blockchain-dependent pages can be hidden/disabled via feature flags during MVP.

---

## 10. Recommended Dev Workflow (Checklist)

1.  **Terminal A**: start emulators

    ```bash
    firebase emulators:start --only firestore,functions,auth
    ```

2.  **Terminal B**: run Next.js

    ```bash
    yarn dev
    ```

3.  Use Emulator UI (port 4000) to:

    - create test users (Auth emulator)
    - inspect Firestore writes

4.  Before committing:
    - `yarn lint`
    - `yarn build`
    - `firebase emulators:exec --only firestore,functions,auth "yarn test"`
