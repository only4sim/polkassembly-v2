# DemoOS – Agent Instructions (Read First)

## 1) North Star Goal
DemoOS is a Polkassembly-v2 style app that replaces ALL blockchain-dependent operations with Firebase:
- Firestore for data
- Cloud Functions for trusted writes and aggregation
- Firebase Hosting for deployment

MVP must NOT require any blockchain-related API keys or on-chain access.

## 2) MVP Scope (Must Ship in 1 month)
A) Auth: Email/Password sign up + sign in
B) Posts: create/list/detail
C) Comments: create/list on posts
D) Voting:
   - Multi-select voting (user can pick multiple options)
   - One-person-one-vote results (points only as eligibility gate)
   - Real-time charts based on aggregated stats doc
E) Moderation: pin / lock / hide posts (admin only)
F) Notifications/subscriptions: OUT OF SCOPE for MVP

## 3) Key Product Decisions
- Voting is one-person-one-vote.
- Introduce off-chain "pointsBalance" as NON-transferable NON-tradable site points.
  - pointsBalance is used ONLY as voting eligibility threshold (e.g., >= 1 can vote).
- Admin role is created by manually setting Firestore: users/{uid}.role = "admin".

## 4) Hard Constraints (Do NOT violate)
- Do NOT add new blockchain dependencies (@polkadot/*, indexers, Subscan/Subsquare clients, etc.).
- Do NOT require blockchain keys to build or run.
- Do NOT commit secrets (service account JSON, private keys, tokens).
- Sensitive writes must go through Cloud Functions or server-side API routes:
  - voting writes
  - moderation (pin/lock/hide)
  - points grants
- When a feature is disabled via flags, code MUST NOT crash:
  - no top-level side effects that throw
  - show disabled UI or remove navigation entry

## 5) Feature Flags & Build Safety
- A feature being disabled must also be excluded from build-time import paths.
- Avoid static imports to disabled modules from any route/page loaded in MVP.
- Put blockchain-only code behind lazy imports or separate entrypoints.

## 6) Testing Strategy
- Use Firebase Local Emulator Suite for local and CI tests:
  - Firestore + Auth + Functions emulators
- Prefer a single command for CI/local repeatability:
  firebase emulators:exec --only firestore,functions,auth "<test command>"
- Do not require production Firebase credentials for tests.

## 7) PR Quality Bar
- Keep PRs small and focused (< 400 lines when possible).
- Update or add tests when implementing logic.
- Document new endpoints/data models in docs/.
- Ensure yarn build and tests pass before requesting review.
