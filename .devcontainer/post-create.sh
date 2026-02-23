#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "  Polkassembly V2 - Environment Setup"
echo "========================================="

# ---- 1. Install project dependencies ----
echo ""
echo ">>> Installing project dependencies (yarn) ..."
yarn install --frozen-lockfile

# ---- 2. Install Firebase CLI globally ----
echo ""
echo ">>> Installing Firebase CLI ..."
npm install -g firebase-tools
echo "Firebase CLI version: $(firebase --version)"

# ---- 3. Install functions dependencies ----
echo ""
echo ">>> Installing Firebase Functions dependencies ..."
cd functions && npm install && cd ..

# ---- 4. Download Firebase emulators ----
echo ""
echo ">>> Downloading Firebase emulators (firestore, auth) ..."
# Pre-download emulator JARs so first start is fast
firebase setup:emulators:firestore
firebase setup:emulators:ui

# ---- 5. Verify Java is available (required by Firebase emulators) ----
echo ""
echo ">>> Verifying Java installation ..."
java -version

echo ""
echo "========================================="
echo "  Setup complete!"
echo ""
echo "  To start Firebase emulators:"
echo "    firebase emulators:start --only firestore,functions,auth"
echo ""
echo "  To start the dev server (in another terminal):"
echo "    yarn dev"
echo ""
echo "  App:            http://localhost:3000"
echo "  Emulator UI:    http://localhost:4000"
echo "========================================="
