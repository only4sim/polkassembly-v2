# Copy-paste Prompt: Repair Points-based Referenda

将下面 prompt 原样复制给位于仓库根目录的 AI Agent。它要求 Agent 真正实施修复，而不是再做一次审阅。

```text
You are the implementation owner responsible for repairing the existing
Firebase-backed, points-based Referenda implementation in the polkassembly-v2
repository. This is an implementation task, not an audit or planning-only task.

Repository root
===============

/workspaces/polkassembly-v2

Primary outcome
===============

Repair the implementation until it satisfies the authoritative product contract and
the repair guide. Inspect the current dirty worktree, implement the fixes, add the
missing tests and documentation, run verification, diagnose failures, and continue
until the Definition of Done is met or a genuine blocker requires user input.

Do not stop after writing a plan, describing patches, adding scaffolding, or fixing only
the P0 findings. Complete the security, transaction, lifecycle, client, UI, regression,
test, documentation, and cleanup phases that are applicable.

Mandatory reading before editing
================================

Read these files completely, in this order:

1. docs/AGENTS.md
2. docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md
3. docs/REFERENDA_POINTS_REVIEW_REPORT.md
4. docs/REFERENDA_POINTS_REPAIR_GUIDE.md
5. docs/ARCHITECTURE.md
6. docs/DEV_GUIDE.md
7. docs/DEV_NO_KEYS.md
8. README.md

Then inspect every implementation and test file named by the review report and repair
guide. Also inspect all applicable AGENTS.md files, package scripts, TypeScript configs,
Firebase configuration, existing Firebase auth/user/post/comment patterns, and the
original chain Referenda components listed in the development guide.

Authority order
===============

Apply requirements in this order:

1. New explicit user instructions.
2. docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md.
3. docs/REFERENDA_POINTS_REPAIR_GUIDE.md.
4. docs/REFERENDA_POINTS_REVIEW_REPORT.md as evidence of the starting defects.

If repository evidence shows that a reported line number moved, fix the underlying
behavior rather than blindly editing the old line. If a product decision truly conflicts
with the authoritative development guide, update the guide and tests only after clearly
identifying the conflict; do not silently change the product contract.

Dirty-worktree and preservation rules
=====================================

- Start with git status --short, git diff --stat, and focused diffs.
- Preserve unrelated user changes. Never use git reset --hard, git checkout --, broad
  git restore, or destructive cleanup.
- The worktree currently contains about 208 unrelated SVG edits that changed </svg> to
  </svg>;, plus unrelated skill/lock-file formatting. Do not continue editing them and
  do not revert them without explicit user authorization. Keep your repair changes
  isolated and report that those existing changes must be excluded from the Referenda
  PR.
- Preserve the original blockchain Referenda implementation. Keep provider selection at
  page/API boundaries and keep original chain bodies in chain-specific sibling files.
- Do not rewrite existing chain components with large environment branches.
- Never commit secrets, service-account JSON, tokens, private keys, or production data.

Non-negotiable product rules
============================

- One effective vote per verified Firebase UID per referendum.
- Decisions are only aye, nay, and abstain.
- pointsUsed is a safe integer from 1 through the authoritative current pointsBalance.
- Voting does not spend or deduct points; pointsUsed and balanceAtVote are snapshots.
- Updating a vote revalidates against the current balance.
- Create, change, and remove are allowed only while status is Deciding and
  votingStartsAt <= serverNow < votingEndsAt.
- Abstain contributes to turnout but not the approval denominator.
- Final approval must be compared exactly to approvalThresholdBps. Do not use a rounded
  display value to decide the outcome.
- Lifecycle is Submitted -> Deciding -> Confirmed or Rejected, with admin cancellation.
- Do not add split, splitAbstain, conviction, locks, delegation, wallet identity, DOT,
  deposits, preimages, enactment, or chain curves to points mode.

Mandatory repair sequence
=========================

Maintain a concrete working plan and execute these phases in order. At most one phase
should be in progress at a time. Do not pause after a phase when the next phase can be
completed safely.

Phase 0 - Baseline and executable test entrypoint

- Re-run and record the current baseline commands from the repair guide.
- Fix yarn test:emulators properly. Prefer self-seeding emulator tests and removing the
  invalid --import argument; do not create an empty directory as a fake fix.
- Ensure the command runs real rules plus repository/service/API tests and shuts down.

Phase 1 - Security and HTTP contracts

- Map VoteValidationError, CreationValidationError, auth-token failures, and service
  errors to the required 401/400/403/404/409 responses instead of 500.
- Use one standard error body and one standard own-vote response family:
  { vote }, { vote, stats }, and { removed: true, ... }.
- Repair Firestore rules without regressing posts/comments. Prevent arbitrary post
  updates, author takeover, client moderation, incorrect delete ownership checks,
  direct referendum/vote/stats/counter writes, and role/points writes.
- Add the complete allow/deny rule matrix from the repair guide.
- Keep public vote history only through a dedicated public DTO that excludes Firebase
  UID, balanceAtVote, email, role, and private profile data.

Phase 2 - Transactional and numeric correctness

- Require and validate the authoritative user document and safe non-negative integer
  pointsBalance.
- Extract a pure, tested stats delta function for create, same-decision amount change,
  decision change, remove, and idempotent identical PUT.
- Remove Math.max clamping. Detect and reject corrupt/missing aggregate states that
  cannot be reconciled safely during a normal vote.
- Validate every stored/intermediate/result number as a safe non-negative integer and
  prevent aggregate overflow.
- Use the half-open voting window, rejecting exactly at votingEndsAt.
- Decide final approval with exact integer comparison, using transient BigInt if needed;
  do not use Math.round output for passage.
- Allocate the counter, referendum document, and initial stats in one Firestore
  transaction using a documented nextIndex representation.
- Add emulator concurrency tests and compare final stats to a fresh aggregation of vote
  documents after every concurrent scenario.

Phase 3 - Lifecycle and scheduled processing

- Implement a single authoritative scheduled lifecycle processor that opens eligible
  Submitted referenda and finalizes expired Deciding referenda.
- Make transitions transactional, idempotent, observable, and retry-safe.
- Do not swallow top-level scheduler errors after logging.
- Remove or refactor the unused Next.js finalization method that necessarily calls the
  outcome function with a rejected status.
- Set the correct initial Submitted/Deciding status inside the creation transaction and
  reject already-expired creation windows.
- Add injectable-clock/emulator tests for exact start/end boundaries, pass/reject,
  cancellation, retries, batch behavior, and vote/finalization races.

Phase 4 - Auth-aware client and realtime data

- Create one typed points Referenda client service instead of scattered raw fetch calls.
- Wait for Firebase auth readiness. Fetch /votes/me only for an authenticated user and
  include the ID token. Never treat an error body as a vote.
- Serve initial list/detail/stats data from the server provider. Use notFound and the
  existing server error UI correctly.
- Give realtime stats the server-provided initial value and exactly one listener on
  referenda/{index}/stats/current. Remove the HTTP/listener race, calculate derived
  fields correctly, preserve the last known value on listener error, and unsubscribe.
- Explicitly refetch/invalidate the list after creation, including when already on page
  one. Return the final created status from the API.
- Add client-service and component tests for auth loading, anonymous, no vote, existing
  vote, 401/404, listener update/error/unsubscribe, and creation refresh.

Phase 5 - UI parity and accessibility

- Follow the reuse matrix in the development and repair guides. Reuse or safely
  generalize ListingPage/ListingTab/ListingCard, PostHeader/PostContent/PostComments,
  StatusTag, voting shell/ChooseVote, vote summary/history, and success interaction when
  their semantics match.
- Add status/origin filters, URL pagination, points-native metrics, comments, meaningful
  timeline/window display, aggregate summary, and privacy-safe vote history.
- Implement a Firebase login gate, current pointsBalance, Use max, raw input validation,
  Aye/Nay/Abstain, existing-vote editing, removal, duplicate-submit prevention, inline
  server errors, and a points-native success state.
- Do not render or import wallet, DOT/USD, conviction, locks, delegation, deposits,
  preimages, beneficiaries, payouts, chain curves, or chain analytics in DemoOS mode.
- Move new user-visible strings into the existing localization system and add proper
  labels, keyboard semantics, focus behavior, and hydration-safe date formatting.

Phase 6 - Chain regression and provider isolation

- Restore the original network-aware list/detail metadata in the actual page.tsx route
  exports; metadata exported by an imported ordinary component is not sufficient.
- With ENABLE_BLOCKCHAIN=true, prove that the original API/provider, wallet/DOT/
  conviction UI, transaction service, and metadata remain in use and the points API is
  not called.
- With ENABLE_BLOCKCHAIN=false, prove that pages do not redirect, use Firebase/points,
  and do not initialize wallet, Polkadot API, RPC, indexer, or chain analytics.
- Keep chain imports out of the DemoOS runtime component tree.

Phase 7 - Documentation and final verification

- Update README.md, docs/ARCHITECTURE.md, docs/DEV_GUIDE.md, docs/DEV_NO_KEYS.md, and API/
  schema documentation so they describe the finished implementation rather than an
  upcoming milestone.
- Remove unused dependencies introduced by this feature, such as jasmine if still
  unused. Avoid lockfile churn unrelated to an actual dependency change.
- Format only files in scope, inspect git diff --check and focused diffs, and make sure
  no new unrelated asset/skill changes were added.
- Run every final verification command in the repair guide. Diagnose and fix failures;
  distinguish genuine pre-existing repository failures from your changes with evidence.

Required tests
==============

Implement the complete test matrix in section 11 of
docs/REFERENDA_POINTS_REPAIR_GUIDE.md. In particular, completion requires:

- pure outcome, exact-threshold, validation, delta, mapping, capabilities tests;
- Firestore emulator unique-index, create/change/remove, missing/corrupt state,
  concurrent vote, transaction retry, and lifecycle tests;
- API 401/400/403/404/409, spoofing, privacy, and stable DTO tests;
- the full Firestore rules allow/deny matrix, including existing posts/comments;
- component/client tests for login, balance/max, validation, existing vote, remove,
  loading/error/success, realtime cleanup, filters, points formatting, and closed state;
- both feature-flag regression paths.

Verification commands
=====================

At minimum run and report the exact result of:

yarn test
yarn test:rules
yarn test:emulators
yarn tsc --noEmit
(cd functions && npm run lint && npm run build)
git diff --check

Run the no-chain build with all optional integrations disabled exactly as documented in
section 12 of the repair guide. Run focused chain-mode regression tests and any chain
build that is possible without missing external credentials. Never claim a test, build,
emulator flow, browser flow, or chain regression passed unless you actually ran it.

Stop conditions
===============

Do not stop merely because the task is large, a test fails, the worktree is dirty, or a
fix needs refactoring. Investigate and continue within scope.

Stop and ask the user only if:

- a required product/privacy decision conflicts with the authoritative guide and cannot
  be resolved from repository evidence;
- completing the work requires credentials, external coordination, or authorization for
  a destructive/unrelated change;
- unrelated user edits overlap a required target so directly that they cannot be safely
  preserved.

Definition of Done
==================

Use every checkbox in section 13 of docs/REFERENDA_POINTS_REPAIR_GUIDE.md. Do not declare
completion with any unchecked item unless it is genuinely inapplicable and you explain
why with evidence.

Final handoff
=============

Use the exact handoff structure in section 14 of the repair guide. Include a P0/P1/P2
resolution table, DemoOS and chain behavior, security/transaction/lifecycle guarantees,
components reused and chain concepts excluded, exact commands and outcomes, changed
files grouped by area, unverified items or blockers, and unrelated existing worktree
changes that still need to be excluded from the Referenda PR.

Begin now: read all mandatory documents, inspect the dirty worktree, create a phased
working plan, establish the baseline, and immediately start Phase 0 implementation.
```
