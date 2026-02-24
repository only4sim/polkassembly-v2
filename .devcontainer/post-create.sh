#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "  Polkassembly V2 - Environment Setup"
echo "========================================="

# ---- 1. Install Java Runtime (required by Firebase Emulators) ----
echo ""
echo ">>> Installing OpenJDK 21 JRE headless ..."
sudo apt-get update -qq && sudo apt-get install -y -qq openjdk-21-jre-headless > /dev/null
echo "Java version: $(java -version 2>&1 | head -1)"

# ---- 2. Install project dependencies ----
echo ""
echo ">>> Installing project dependencies (yarn) ..."
yarn install --frozen-lockfile

# ---- 3. Install Firebase CLI globally ----
echo ""
echo ">>> Installing Firebase CLI ..."
npm install -g firebase-tools
echo "Firebase CLI version: $(firebase --version)"

# ---- 4. Install functions dependencies ----
echo ""
echo ">>> Installing Firebase Functions dependencies ..."
cd functions && npm install && cd ..

# ---- 5. Download Firebase emulators ----
echo ""
echo ">>> Downloading Firebase emulators (firestore, auth) ..."
# Pre-download emulator JARs so first start is fast
firebase setup:emulators:firestore
firebase setup:emulators:ui

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
