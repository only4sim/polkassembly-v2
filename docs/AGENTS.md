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

## 8) MVP Implementation Roadmap (Issue/PR Tracker)

> Issues ordered by priority. Dependency arrows show which must merge first.
> Parallelizable pairs: #1 ∥ #2, #7 ∥ #8.

| #   | Title                                                                    | Status         | Depends On          | Est. Size |
| --- | ------------------------------------------------------------------------ | -------------- | ------------------- | --------- |
| 1   | Strip non-MVP blockchain routes & stabilize no-chain build               | 🔲 not started | —                   | M         |
| 2   | Firebase client SDK init + emulator auto-connect                         | 🔲 not started | —                   | S         |
| 3   | User profile (`users/{uid}`) + admin role + `onAuthUserCreated` function | 🔲 not started | #2                  | M         |
| 4   | Email/Password auth (register / login / logout)                          | 🔲 not started | #2, #3              | M         |
| 5   | Posts CRUD (create / list / detail for discussions)                      | 🔲 not started | #3, #4              | L         |
| 6   | Comments CRUD                                                            | 🔲 not started | #5                  | M         |
| 7   | Voting (multi-select, gate-only, one-person-one-vote) + realtime stats   | 🔲 not started | #5, #3              | L         |
| 8   | Moderation (pin / lock / hide) via admin-only Cloud Functions            | 🔲 not started | #5, #3              | M         |
| 9   | Firestore security rules + CI test harness                               | 🔲 not started | #3–#8 (incremental) | M         |

### Dependency Graph

```
#1 (strip routes) ──────────────────────────────────────────┐
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
| `users/{uid}`                         | `uid, email, displayName, role('user'\|'admin'), pointsBalance(default 0), createdAt, updatedAt`                                                                  | Read: any authed user; Write: Cloud Functions only                  |
| `posts/{postId}`                      | `id, title, content, authorUid, authorDisplayName, type('discussion'), status('active'\|'locked'\|'hidden'), isPinned, commentCount, poll?, createdAt, updatedAt` | Read: public (active); Write: authed (create), Functions (moderate) |
| `posts/{postId}/comments/{commentId}` | `id, postId, authorUid, authorDisplayName, content, createdAt`                                                                                                    | Read: public; Create: authed (if post active)                       |
| `posts/{postId}/votes/{uid}`          | `uid, selectedOptions[], votedAt`                                                                                                                                 | Read: own only; Write: Cloud Functions only                         |
| `posts/{postId}/stats/votes`          | `totalVoters, optionCounts[], lastUpdated`                                                                                                                        | Read: public; Write: Cloud Functions only                           |

### Cloud Functions (DemoOS MVP)

| Function            | Trigger                | Purpose                                                     |
| ------------------- | ---------------------- | ----------------------------------------------------------- |
| `onAuthUserCreated` | `auth.user().onCreate` | Auto-create `users/{uid}` doc with defaults                 |
| `castVote`          | `onCall` (callable)    | Validate eligibility + write vote + update stats atomically |
| `moderatePost`      | `onCall` (callable)    | Verify admin role + apply pin/lock/hide action              |

### How to Set a User as Admin

1. **Emulator UI**: Open http://localhost:4000/firestore → `users/{uid}` → edit `role` to `"admin"`
2. **CLI**: `curl -X PATCH "http://localhost:8080/v1/projects/demo-project/databases/(default)/documents/users/TARGET_UID" -H "Content-Type: application/json" -d '{"fields":{"role":{"stringValue":"admin"}}}'`
