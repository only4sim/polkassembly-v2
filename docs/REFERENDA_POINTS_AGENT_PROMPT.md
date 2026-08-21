# Copy-paste Prompt: Build Points-based Referenda

Use the prompt below to start a new AI Agent in the repository root. It is intentionally
execution-oriented: the Agent must inspect the existing implementation, make the code
changes, run tests, and continue until the feature is complete or genuinely blocked.

The detailed product and architecture contract remains
[`REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`](./REFERENDA_POINTS_DEVELOPMENT_GUIDE.md). If
this prompt and that guide ever differ, the guide is authoritative unless the user gives
newer explicit instructions.

## Prompt

```text
You are the implementation owner for the next DemoOS milestone in the
polkassembly-v2 repository: complete Firebase-backed, points-based Referenda while
preserving the original blockchain Referenda implementation.

Your task is to implement the feature end to end. Do not stop after producing a plan,
architecture proposal, audit, or scaffolding. Inspect the repository, implement the
code, add tests and documentation, run appropriate verification, fix failures, and
continue until the Definition of Done is satisfied or a real blocker requires user
input.

Repository root:
/workspaces/polkassembly-v2

Mandatory reading before editing
================================

Read these files completely and treat them as project instructions:

1. docs/AGENTS.md
2. docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md
3. docs/ARCHITECTURE.md
4. docs/DEV_GUIDE.md
5. docs/DEV_NO_KEYS.md
6. README.md

Then inspect the existing code paths listed in section 4 of
docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md, especially:

- src/app/(listing)/referenda/page.tsx
- src/app/referenda/[index]/page.tsx
- src/app/_shared-components/ListingComponent/ListingPage/ListingPage.tsx
- src/app/_shared-components/ListingComponent/ListingCard/ListingCard.tsx
- src/app/_shared-components/PostDetails/PostDetails.tsx
- src/app/_shared-components/PostDetails/VoteReferendumButton.tsx
- src/app/_shared-components/PostDetails/VoteReferendum/VoteReferendum.tsx
- src/app/_shared-components/PostDetails/UserVoteStatus/UserVoteStatus.tsx
- src/app/_shared-components/PostDetails/VotesData/VotesData.tsx
- src/app/api/v2/[proposalType]/route.ts
- src/app/api/v2/[proposalType]/[index]/route.ts
- src/app/api/v2/posts/[id]/vote/route.ts
- functions/src/castVote.ts
- src/app/_shared-components/DemoPost/DemoVoteSection.tsx
- src/app/_client-services/firebase/useFirebaseAuth.ts
- src/adapters/firestore/FirestoreUserRepository.ts

Inspect all relevant AGENTS.md files, repository status, package scripts, Firebase
configuration, tests, and related types before editing. Preserve unrelated user changes
in a dirty worktree.

Primary outcome
===============

When ENABLE_BLOCKCHAIN=false:

- /referenda displays Firebase-backed referenda using the existing Referenda listing
  visual language and interactions.
- /referenda/{index} displays a Firebase-backed referendum using as much of the existing
  detail UI, comments, status, timeline, vote summary, and history UI as is semantically
  correct.
- Authenticated users can create a points-based referendum through a DemoOS form that
  reuses appropriate existing proposal form patterns without entering a wallet or
  extrinsic flow.
- Authenticated Firebase users can cast, change, and remove Aye/Nay/Abstain votes using
  pointsBalance as voting power.
- Aggregate results update in realtime.
- The feature requires no wallet, Polkadot API, RPC, indexer, blockchain key, Redis, or
  Algolia.

When ENABLE_BLOCKCHAIN=true:

- Existing chain Referenda behavior remains unchanged.
- Existing wallet selection, DOT balance, conviction, delegation, chain data, and
  transaction submission continue to work.
- No points-based Referenda API is used.

Product rules
=============

Implement the product contract from docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md. The key
rules are:

- One effective vote per Firebase UID per referendum.
- The user selects an integer points amount from 1 through their current pointsBalance.
- pointsUsed is the vote weight.
- Points are not transferred, spent, or permanently deducted.
- pointsUsed is snapshotted when the vote is written; later balance changes do not
  silently rewrite prior votes.
- A changed vote is revalidated against the current pointsBalance.
- Votes may be created, changed, or removed only while the referendum is in Deciding
  status and inside its server-validated voting window.
- First release decisions: aye, nay, abstain.
- Do not implement split, splitAbstain, conviction, lock periods, delegation, wallet
  identity, or governance-lock reuse for points voting.
- Abstain counts toward turnout but not the approval denominator.
- approval = ayePoints / (ayePoints + nayPoints), or zero when the denominator is zero.
- Final outcome uses the referendum's stored approvalThresholdBps and
  minimumTurnoutPoints.
- Lifecycle: Submitted -> Deciding -> Confirmed or Rejected; administrators may cancel.

Mandatory architecture
======================

Preserve upstream code. Add the Firebase implementation beside the chain
implementation. Do not replace or delete the original Referenda components, APIs, or
services.

Use a provider split at page/API boundaries:

- ENABLE_BLOCKCHAIN=true selects the original chain implementation.
- ENABLE_BLOCKCHAIN=false selects the Firebase/points implementation.
- Shared UI receives normalized view models and should not discover the data source by
  scattering environment-variable checks throughout child components.
- If static imports pull blockchain dependencies into the no-chain build, move the
  original page body unchanged into a chain implementation component and use a thin
  wrapper/dynamic import to select the provider.

DemoOS runtime paths must not import or initialize:

- @polkadot/*
- wallet hooks/components
- polkadot_api_service
- indexer/on-chain services
- conviction/delegation/lock modules

Build domain entities, repository ports, Firestore adapters, trusted services, API
routes, client services, and DemoOS UI as separate layers. Domain code must not import
Firebase, Next.js, React, or Polkadot libraries.

Reuse UI where semantics match. Reuse or carefully generalize:

- ListingPage, ListingTab, and ListingCard structure
- PostHeader, PostContent, PostComments, and StatusTag
- VoteReferendumButton dialog/login shell
- ChooseVote for Aye/Nay/Abstain
- BalanceInput visual structure, or add a PointsInput beside it
- VoteSummary and vote-history layouts with point-native formatting
- success-modal and comment-after-vote interaction

Do not render or call chain-only concepts in DemoOS mode:

- wallet/address picker
- DOT/token formatting or USD conversion for voting power
- conviction and locks
- delegation
- decision/refund deposits
- beneficiaries/payouts
- preimages/enactment
- chain approval/support curves
- chain analytics endpoints

Data model
==========

Implement and document these Firestore paths unless repository evidence requires a
better compatible shape:

- referenda/{index}
- referenda/{index}/votes/{uid}
- referenda/{index}/stats/current
- counters/referenda

Use a transactionally allocated stable numeric index. Never allocate indexes from a
collection count or last-document query.

Referendum data must include at least:

- index, title, content
- authorUid, authorDisplayName
- origin, status, tags/topic as supported
- votingStartsAt, votingEndsAt
- approvalThresholdBps, minimumTurnoutPoints
- createdAt, updatedAt, optional closedAt
- schemaVersion

Vote data must include at least:

- uid, voterDisplayName
- decision
- pointsUsed
- balanceAtVote
- createdAt, updatedAt
- schemaVersion

Aggregate stats must include:

- ayePoints, nayPoints, abstainPoints
- ayeVoters, nayVoters, abstainVoters
- totalVoters
- updatedAt and schemaVersion

Use safe integer validation consistently. Do not mix number, bigint, and decimal-string
representations without an explicit repository-wide decision and migration plan.

Trusted voting transaction
==========================

All vote mutations must run through a trusted Next.js API route or Cloud Function. The
browser must never directly write votes or stats.

For vote create/change, one Firestore transaction must:

1. Read referendum, authenticated user profile, existing vote, and aggregate stats.
2. Perform all reads before writes.
3. Validate verified Firebase UID, current server time, Deciding status, voting window,
   decision, integer pointsUsed, and pointsUsed <= current pointsBalance.
4. Subtract the existing vote's points and voter count from its old bucket when changing
   a vote.
5. Add the new vote's points and voter count to the new bucket.
6. Prevent negative counters.
7. Upsert vote and stats with server timestamps.

For vote removal, one transaction must read the referendum, vote, and stats, validate
that voting is still open, subtract the old contribution, delete the vote, and update
stats. Prefer idempotent success when no vote exists and cover that choice with tests.

Never trust uid, role, display name, pointsBalance, author identity, or existing vote
data from the request body. Derive identity from a verified Firebase ID token and read
authoritative data server-side.

API expectations
================

Implement one coherent API family. Prefer these explicit contracts unless clean reuse
of the generic proposal routes avoids duplication:

- GET /api/v2/referenda
- GET /api/v2/referenda/{index}
- GET /api/v2/referenda/{index}/stats
- GET /api/v2/referenda/{index}/votes
- GET /api/v2/referenda/{index}/votes/me
- PUT /api/v2/referenda/{index}/votes/me
- DELETE /api/v2/referenda/{index}/votes/me

Use ISO date strings at HTTP boundaries and the project's standard error response.
Avoid implementing the same business rules in both explicit and generic route families.

Realtime results
================

Subscribe to referenda/{index}/stats/current only, not the whole votes collection.
Provide server-rendered initial stats, attach one client listener, unsubscribe on
unmount, handle missing/permission errors, and avoid hydration-shape mismatches.

Security requirements
=====================

Add and check in:

- firestore.rules
- firestore.indexes.json
- firebase.json references to both files
- @firebase/rules-unit-testing emulator tests

Required rules intent:

- public referendum and aggregate-stat reads
- no direct client referendum lifecycle mutation
- no direct client vote mutation
- no direct client stats mutation
- no client pointsBalance or role mutation
- own-vote read only if the client needs it
- no unauthorized access to private voter/profile data

Test anonymous and authenticated denial cases, public read cases, own-vote access if
used, and non-admin lifecycle mutation denial.

Creation and lifecycle
======================

Implement a coherent creation/lifecycle path after read and vote paths work:

- Trusted referendum creation with server-assigned author and numeric index.
- Validate title, content, origin allowlist, dates, thresholds, tags, and limits.
- Only administrators may cancel, force-close, or change lifecycle fields after voting
  starts.
- Add idempotent scheduled finalization or an equivalent trusted process that closes
  expired referenda and writes Confirmed/Rejected from the stored aggregate and
  thresholds.
- Wire the DemoOS create CTA to the completed trusted creation flow. Never route DemoOS
  users into the existing wallet extrinsic creation flow.

Implementation phases
=====================

Maintain a working plan and execute these phases in order. Do not pause after a phase if
you can continue safely.

Phase 0 - contracts and fixtures

- Domain Referendum/Vote/Stats types
- outcome calculation and validation
- repository ports and DTO/view-model mappings
- emulator seed fixtures
- pure unit tests

Phase 1 - read path

- Firestore repository/adapters
- list/detail APIs
- feature-flag page providers
- reused listing/detail UI with capabilities controlling chain-only panels
- repository/API/component tests

Phase 2 - points voting

- trusted transactional service and endpoints
- points vote dialog/status/edit/remove flow
- summary/history and realtime aggregate
- auth, concurrency, validation, API, and component tests

Phase 3 - rules and indexes

- checked-in rules/indexes and firebase.json wiring
- emulator security-rule tests
- repeatable local/CI emulator command

Phase 4 - creation and lifecycle

- trusted creation and index allocation
- admin cancellation/closure
- scheduled finalization
- lifecycle/outcome tests
- working DemoOS create CTA

Phase 5 - parity and hardening

- profile vote history/activity where appropriate
- point-native visual polish
- localization and accessibility
- responsive/empty/error/loading states
- read-cost/performance review
- full regression verification

Testing and verification
========================

Discover the repository's actual package manager and scripts before running commands.
Add missing focused test scripts/infrastructure when required. Use Firebase Emulator
Suite for Firestore/Auth/Functions integration and rules tests; do not require production
credentials.

At minimum verify:

- outcome calculations and boundary values
- mapping and serialization
- unique index allocation under concurrency
- list filters and pagination
- vote create/change/remove aggregate correctness
- concurrent voting and transaction retries
- authentication and identity spoof rejection
- insufficient balance, invalid amount/decision, missing/expired/closed referendum
- security rule allow/deny matrix
- login gate, max points, existing vote, loading/error/success UI
- realtime stats listener cleanup and error fallback
- no-chain build with optional integrations disabled
- Functions build/type checking/linting relevant to changed files
- chain-mode Referenda regression behavior

Run formatting and git diff checks. If a command fails, diagnose and fix the failure
rather than merely reporting it. Clearly separate pre-existing failures from failures
introduced by your changes.

Working rules
=============

- Start by inspecting git status. Never discard unrelated changes.
- Use existing project patterns and aliases.
- Search before creating duplicate utilities or components.
- Keep original chain files intact where possible; prefer new sibling files and thin
  provider wrappers.
- Keep changes logically staged and reviewable even if you are not creating commits.
- Update tests and documentation with every contract/schema/API change.
- Do not commit secrets or production credentials.
- Do not claim a test, emulator flow, build, or chain regression passed unless you ran
  it.
- Make reasonable in-scope assumptions and document them. Ask the user only when a
  missing decision would materially change product behavior or require new authority.
- Provide concise progress updates during long work, but keep implementing.

Definition of Done
==================

Do not declare completion until all applicable items below are true:

- DemoOS /referenda and /referenda/{index} work without redirecting.
- List and detail closely match the existing Referenda experience while excluding false
  chain concepts.
- Users can cast, change, and remove weighted Aye/Nay/Abstain point votes.
- Server enforcement prevents over-balance, unauthorized, late, and invalid votes.
- Vote and aggregate documents remain consistent under concurrency.
- Aggregate results update in realtime.
- Trusted creation, numeric index allocation, lifecycle transitions, finalization, and
  the DemoOS create CTA are implemented.
- Firestore rules and indexes are checked in and tested.
- No-chain mode initializes no wallet, Polkadot API, RPC, or indexer dependency.
- Chain mode preserves the existing DOT/conviction/wallet transaction flow.
- Relevant unit, API, emulator, rules, component, formatting, type, lint, build, and
  regression checks pass.
- Documentation accurately describes the final schemas, APIs, feature flags, limitations,
  and test commands.

Final handoff
=============

When the implementation is genuinely complete, report:

1. User-visible functionality delivered.
2. Architecture and data-model changes.
3. Existing components reused and chain-only components excluded.
4. Security and transactional guarantees.
5. Tests and commands run with results.
6. Any remaining limitations or intentionally deferred capabilities.
7. A concise list of changed files grouped by domain, backend, UI, security, tests, and
   documentation.

Begin now by reading the mandatory documents and inspecting the current implementation.
Then create a concrete plan and immediately start Phase 0. Continue through the phases
without waiting for confirmation unless you encounter a genuine product or authority
blocker.
```

## Optional scope overrides

Append one of these instructions when assigning a narrower task:

- `Implement only Phase 0 and Phase 1, but leave the repository in a tested, mergeable state.`
- `Implement only the points-voting backend and emulator tests; do not change UI routes.`
- `Implement only the DemoOS Referenda UI after verifying that the documented APIs already exist.`
- `Audit the completed implementation against the Definition of Done; fix every in-scope failure you find.`

Do not append a narrow override when the Agent is expected to deliver the complete
feature.
