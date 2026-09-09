# DemoOS – Agent Instructions (Read First)

## 1) North Star Goal

DemoOS is a Polkassembly-v2 style app that replaces ALL blockchain-dependent operations with Firebase:

- Firestore for data
- Cloud Functions for trusted writes and aggregation
- Firebase Hosting for deployment

MVP must NOT require any blockchain-related API keys or on-chain access.

## 2) MVP Scope

- A) Auth: Email/Password sign up + sign in
- B) Posts: create/list/detail
- C) Comments: create/list on posts
- D) Discussion poll voting:

  - Multi-select voting (user can pick multiple options)
  - One-person-one-vote results (points only as eligibility gate)
  - Real-time charts based on aggregated stats doc

- E) Moderation: pin / lock / hide posts (admin only)
- F) Notifications/subscriptions: OUT OF SCOPE for MVP

The Firebase-backed Referenda experience for `ENABLE_BLOCKCHAIN=false` is implemented:
listing, detail, creation, points voting (aye/nay/abstain with a `pointsBalance` weight
snapshot), change/remove voting, comments, real-time aggregates, admin cancellation and
scheduled lifecycle finalization — without initializing wallets, Polkadot APIs, indexers,
or on-chain transactions. Chain mode (`ENABLE_BLOCKCHAIN=true`) keeps the original
Referenda implementation untouched. The frozen HTTP contract is
`docs/REFERENDA_API_CONTRACT.md`; product rules and acceptance criteria remain in
`docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`.

## 3) Key Product Decisions

- Discussion poll voting is one-person-one-vote.
- Introduce off-chain "pointsBalance" as NON-transferable NON-tradable site points.
  - In discussion polls, `pointsBalance` is used only as an eligibility threshold.
  - In points-based Referenda, the user chooses an integer points amount up to their
    current `pointsBalance`; that amount is the vote weight.
  - Referenda voting does not spend or permanently deduct points. Conviction,
    delegation, split voting, and lock reuse are not part of the first points-based
    Referenda release.
- Admin role is created by manually setting Firestore: users/{uid}.role = "admin".

## 4) Hard Constraints (Do NOT violate)

- Do NOT add new blockchain dependencies (@polkadot/\*, indexers, Subscan/Subsquare clients, etc.).
- Do NOT require blockchain keys to build or run.
- Do NOT commit secrets (service account JSON, private keys, tokens).
- Sensitive writes must go through Cloud Functions or server-side API routes:
  - voting writes
  - moderation (pin/lock/hide)
  - points grants
- When a feature is disabled via flags, code MUST NOT crash:
  - no top-level side effects that throw
  - show disabled UI or remove navigation entry

### 4a) Code Preservation Rule (MANDATORY for every PR)

This project is a **fork** of polkassembly-v2. All original upstream code must be **preserved** so blockchain features can be re-enabled later by flipping a flag.

**NEVER delete or replace original code.** Always ADD alongside it.

When modifying **existing page files** (`page.tsx`):

- Add a feature-flag guard at the top; keep ALL original code below it unchanged.
- If static imports cause build failures, use the dynamic-import wrapper pattern:
  rename original to `*Impl.tsx` and create a thin `page.tsx` that conditionally loads it.

When modifying **existing files** (`functions/src/index.ts`, sidebar constants, etc.):

- APPEND new exports / logic. Do NOT rewrite or remove existing exports.
- Use early-return or conditional blocks so original logic still executes when the flag is enabled.

When creating **DemoOS alternatives** to existing components:

- Create NEW files (e.g., `DemoLoginForm.tsx` alongside `LoginComponent.tsx`).
- In the consuming page, use `ENABLE_BLOCKCHAIN` to switch between original and DemoOS component.
- Original component file must remain untouched.

**Verification**: `git diff` for any PR must show primarily ADDITIONS. Large deletions of original code = PR must be rejected.

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

---

## 8) MVP Implementation Status (Code Audit: 2026-08-21)

The original tracker was not updated as features merged. The table below reflects the
repository, not the historical issue labels.

| #   | Capability                                                   | Status                | Evidence / remaining work                                                          |
| --- | ------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------- |
| 1   | Hide blockchain routes and support a no-chain build          | 🟨 mostly implemented | Many pages and APIs have guards; a clean no-keys build must still be kept in CI.   |
| 2   | Firebase client initialization and emulator connection       | ✅ implemented        | Client Auth/Firestore/Functions initialization exists.                             |
| 3   | User profile, role, points, and auth-create trigger          | ✅ implemented        | `onAuthUserCreated` creates `users/{uid}`; current initial balance is 1000 points. |
| 4   | Email/password registration, login, and logout               | ✅ implemented        | DemoOS auth components and Firebase Auth hooks are present.                        |
| 5   | Discussion post CRUD                                         | ✅ implemented        | Create/list/detail/update/delete APIs and UI are present.                          |
| 6   | Comment CRUD                                                 | ✅ implemented        | Create/list/reply/update/delete and comment-count trigger are present.             |
| 7   | Discussion poll voting and realtime aggregate results        | ✅ implemented        | `castVote`, vote API, UI, and aggregate stats exist.                               |
| 8   | Admin moderation (pin/lock/hide)                             | ⬜ not implemented    | No `moderatePost` Function or equivalent trusted route exists.                     |
| 9   | Firestore rules, indexes, emulator integration tests, and CI | ⬜ not implemented    | No checked-in rules/index files; only one user-profile unit test exists.           |
| 10  | Points-based Referenda parity                                | 🟦 next milestone     | Follow `REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`.                                    |

### Historical MVP Dependency Graph

```
#1 (hide routes) ───────────────────────────────────────────┐
#2 (firebase client SDK) ─→ #3 (user profile) ─→ #4 (auth) │
                                    │                       │
                                    ↓                       │
                              #5 (posts CRUD) ──────────────┤
                               │         │                  │
                               ↓         ↓                  │
                          #6 (comments) #7 (voting) ∥ #8 (moderation)
                                                            │
                                                            ↓
                                                    #9 (rules + CI)
```

### Key Data Collections (Firestore)

| Collection                            | Key Fields                                                                                                                                                        | Access                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `users/{uid}`                         | `uid, email, displayName, role('user'\|'admin'), pointsBalance(default 1000), createdAt, updatedAt`                                                               | Read: any authed user; Write: Cloud Functions only                  |
| `posts/{postId}`                      | `id, title, content, authorUid, authorDisplayName, type('discussion'), status('active'\|'locked'\|'hidden'), isPinned, commentCount, poll?, createdAt, updatedAt` | Read: public (active); Write: authed (create), Functions (moderate) |
| `posts/{postId}/comments/{commentId}` | `id, postId, authorUid, authorDisplayName, content, createdAt`                                                                                                    | Read: public; Create: authed (if post active)                       |
| `posts/{postId}/votes/{uid}`          | `uid, selectedOptions[], votedAt`                                                                                                                                 | Read: own only; Write: Cloud Functions only                         |
| `posts/{postId}/stats/votes`          | `totalVoters, optionCounts[], lastUpdated`                                                                                                                        | Read: public; Write: Cloud Functions only                           |

### Cloud Functions (DemoOS MVP)

| Function            | Trigger                | Purpose                                                     |
| ------------------- | ---------------------- | ----------------------------------------------------------- |
| `onAuthUserCreated` | `auth.user().onCreate` | Auto-create `users/{uid}` doc with defaults                 |
| `castVote`          | `onCall` (callable)    | Validate eligibility + write vote + update stats atomically |
| `moderatePost`      | planned callable/API   | Verify admin role + apply pin/lock/hide action              |

### How to Set a User as Admin

1. **Emulator UI**: Open http://localhost:4000/firestore → `users/{uid}` → edit `role` to `"admin"`
2. **CLI**: `curl -X PATCH "http://localhost:8080/v1/projects/demo-project/databases/(default)/documents/users/TARGET_UID" -H "Content-Type: application/json" -d '{"fields":{"role":{"stringValue":"admin"}}}'`
