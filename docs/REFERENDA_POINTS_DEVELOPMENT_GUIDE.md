# Points-based Referenda Development Guide for AI Agents

> Status: proposed implementation contract for the approved next milestone
>
> Last updated: 2026-08-21
>
> Audience: AI coding agents and developers implementing Referenda in DemoOS mode

To start a new AI Agent with an execution-ready assignment, copy the prompt from
[`REFERENDA_POINTS_AGENT_PROMPT.md`](./REFERENDA_POINTS_AGENT_PROMPT.md).

## 1. Objective

Implement `/referenda` and `/referenda/{index}` for
`ENABLE_BLOCKCHAIN=false` with the same visual language and primary interactions as the
existing `ENABLE_BLOCKCHAIN=true` Referenda experience.

The data source and voting mechanism are different:

- Chain mode continues to read indexed/on-chain referendum data and submit Polkadot
  transactions using DOT.
- DemoOS mode stores referenda and votes in Firestore and uses the authenticated user's
  `pointsBalance` as voting power.
- Existing chain-mode code must remain functional and must not be rewritten or deleted.
- DemoOS Referenda must build and run without a wallet, Polkadot API, indexer, RPC call,
  chain key, Redis, or Algolia.

This milestone is not a text replacement from “DOT” to “Points.” It is a provider split:
reuse presentation and interaction components where their semantics are common, and add
Firebase implementations where chain semantics differ.

## 2. Product Decisions

These decisions are the default implementation contract. Do not silently change them in
a PR. If product requirements change, update this guide and the related tests first.

### 2.1 Voting power

- A user selects an integer number of points from `1` through their current
  `pointsBalance`.
- Selected points are the vote weight: 100 points produces 100 units of voting power.
- Casting a vote does not spend, transfer, or permanently deduct points.
- The recorded `pointsUsed` is snapshotted when the vote is written. A later balance
  change does not retroactively change an existing vote.
- A user can update their vote while the referendum is votable. The updated vote must be
  revalidated against the user's current balance.
- A user can remove their vote while the referendum is votable.
- There is one effective vote per Firebase UID per referendum.

This differs from the existing discussion poll, where points are only an eligibility
gate and every voter has equal weight.

### 2.2 Decisions supported in the first release

- Support `aye`, `nay`, and `abstain`.
- Do not implement `split` or `splitAbstain` in the first release.
- Do not implement conviction multipliers, balance locks, delegation, delegated voting
  power, wallet/account selection, or governance-lock reuse.
- Keep the existing Aye/Nay/Abstain visual controls where possible.
- Do not show disabled chain controls merely to make the dialog look identical. Reuse
  layout and interaction patterns, not misleading semantics.

### 2.3 Outcome calculation

For the first release:

```text
participatingPoints = ayePoints + nayPoints + abstainPoints
approval denominator = ayePoints + nayPoints
approval = ayePoints / approval denominator
turnout = participatingPoints
```

- Abstain contributes to turnout but not the approval denominator.
- A referendum passes when it closes if `approval >= approvalThreshold` and
  `participatingPoints >= minimumTurnoutPoints`.
- Store both thresholds on each referendum so historical outcomes do not change when
  defaults change.
- If `ayePoints + nayPoints` is zero, approval is zero.
- All arithmetic is integer-based. Never use floating-point values for stored point
  totals.

Recommended initial defaults are `approvalThresholdBps = 5000` (50%) and
`minimumTurnoutPoints = 1`. Treat these as configurable application constants, not
hard-coded UI values.

### 2.4 Lifecycle

Use the existing `EProposalStatus` values where they accurately describe the state:

```text
Submitted -> Deciding -> Confirmed | Rejected
                      -> Cancelled
```

- `Submitted`: created but voting has not started.
- `Deciding`: `votingStartsAt <= now < votingEndsAt`; votes may be created, changed, or
  removed.
- `Confirmed` or `Rejected`: final result calculated from the transactional aggregate.
- `Cancelled`: closed by an administrator; no further voting.

Do not emulate decision deposits, preimages, enactment, confirmation curves, or other
OpenGov chain mechanics unless a later milestone explicitly requires them.

## 3. Non-negotiable Engineering Constraints

1. Preserve the original chain implementation. Existing behavior for
   `ENABLE_BLOCKCHAIN=true` is a regression boundary.
2. Select the provider at a server/page/API boundary. Shared visual components should
   not contain scattered environment checks.
3. DemoOS modules must not statically import:
   - `@polkadot/*`
   - wallet hooks or wallet components
   - `polkadot_api_service`
   - indexer/on-chain services
4. All vote mutations and lifecycle transitions are trusted server writes through a
   Next.js API route or Cloud Function. Browser code must never write vote or aggregate
   documents directly.
5. Vote mutation and aggregate update occur in one Firestore transaction.
6. Author identity and balance always come from verified server-side authentication and
   Firestore. Never trust UID, role, display name, or balance sent in the request body.
7. No production secret is required for emulator tests.
8. Add Firestore rules, indexes, and emulator tests before calling the feature complete.

## 4. Existing Referenda Flow to Preserve

Before editing, read these files in this order:

1. `src/app/(listing)/referenda/page.tsx`
   - Currently redirects to `/` in DemoOS mode.
   - Chain mode loads data through `NextApiClientService.fetchListingData`.
2. `src/app/referenda/[index]/page.tsx`
   - Currently redirects to `/` in DemoOS mode.
   - Chain mode renders `PostDetails` using `EProposalType.REFERENDUM_V2` data.
3. `src/app/_shared-components/ListingComponent/ListingPage/ListingPage.tsx`
   - Shared listing header, filters, tabs, and pagination shell.
4. `src/app/_shared-components/ListingComponent/ListingCard/ListingCard.tsx`
   - Referendum card layout, status, progress, and vote summary.
5. `src/app/_shared-components/PostDetails/PostDetails.tsx`
   - Detail layout and the current chain-only right column.
6. `src/app/_shared-components/PostDetails/VoteReferendumButton.tsx`
   - Login gate, dialog shell, and vote trigger.
7. `src/app/_shared-components/PostDetails/VoteReferendum/VoteReferendum.tsx`
   - Chain-specific vote form and transaction submission.
8. `src/app/_shared-components/PostDetails/UserVoteStatus/UserVoteStatus.tsx`
   - Existing-vote query and edit entry point.
9. `src/app/_shared-components/PostDetails/VotesData/VotesData.tsx`
   - Summary, bubble chart, chain curve graph, and history composition.
10. `src/app/api/v2/[proposalType]/route.ts` and
    `src/app/api/v2/[proposalType]/[index]/route.ts`
    - Existing listing/detail API contracts.

Also inspect the current DemoOS patterns before implementing:

- `src/app/api/v2/posts/[id]/vote/route.ts`
- `functions/src/castVote.ts`
- `src/app/_shared-components/DemoPost/DemoVoteSection.tsx`
- `src/app/_client-services/firebase/useFirebaseAuth.ts`
- `src/adapters/firestore/FirestoreUserRepository.ts`

## 5. Reuse Matrix

### 5.1 Reuse directly or with small generic props

| Existing UI                                  | Expected reuse                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ListingPage`                                | Reuse header, tabs, filters, pagination, and loading behavior. Add props only when the off-chain behavior genuinely differs. |
| `ListingTab` and `ListingCard`               | Reuse card structure. Make token formatting injectable so points are not passed through DOT formatting.                      |
| `PostHeader`, `PostContent`, `PostComments`  | Reuse directly after adapting the Firestore response to the expected view model.                                             |
| `StatusTag`                                  | Reuse existing statuses.                                                                                                     |
| `VoteReferendumButton` dialog shell          | Extract/reuse login gate, dialog trigger, title, and close behavior.                                                         |
| `ChooseVote`                                 | Reuse Aye/Nay/Abstain choices; hide unsupported split variants through an explicit prop or a new constrained wrapper.        |
| `BalanceInput` visual structure              | Generalize labels/unit/validation, or create `PointsInput` beside it if generalizing risks chain regressions.                |
| `VoteSummary` and vote history layout        | Reuse after introducing a points formatter and a normalized vote DTO.                                                        |
| Success modal and comment-after-vote pattern | Reuse the interaction, replacing wallet address and conviction details with user and points details.                         |

### 5.2 Do not reuse in the DemoOS runtime path

- `SwitchWalletOrAddress`
- `AddressRelationsPicker`
- `usePolkadotApiService`
- `usePolkadotVault`
- `ConvictionSelector`
- governance lock and locked-balance queries
- received delegation queries
- `polkadot_api_service.voteReferendum`
- decision-deposit, refund-deposit, beneficiary payout, preimage, or enactment controls
- chain vote curves and track-specific approval/support calculations

If a shared parent statically imports one of these modules, split it into a neutral shell
and chain/DemoOS implementations, then dynamically import the selected implementation.

## 6. Target Module Shape

Use new files beside the existing implementation. Names may be refined, but keep the
responsibilities separated:

```text
src/domain/entities/
  Referendum.ts
  ReferendumVote.ts
src/domain/services/
  calculateReferendumOutcome.ts
src/ports/repositories/
  ReferendumRepository.ts
  ReferendumVoteRepository.ts
src/adapters/firestore/
  FirestoreReferendumRepository.ts
  FirestoreReferendumVoteRepository.ts
src/app/api/_api-services/
  pointsReferendumService.ts
src/app/api/v2/referenda/
  route.ts
  [index]/route.ts
  [index]/votes/route.ts
  [index]/votes/me/route.ts
  [index]/stats/route.ts
src/app/_shared-components/Referenda/
  ReferendumListingProvider.tsx
  ReferendumDetailsProvider.tsx
  PointsReferendumVote.tsx
  PointsReferendumVoteStatus.tsx
  PointsReferendumVotesData.tsx
  ReferendumVotingShell.tsx
src/app/_client-services/
  points_referenda_client_service.ts
```

Prefer the existing generic `/api/v2/[proposalType]` contract if it can branch cleanly
without mixing auth systems or chain imports into the DemoOS path. Otherwise use the
explicit `/api/v2/referenda` routes above and adapt their results to shared UI view
models. Do not duplicate business rules in both route families.

## 7. Domain Model

Use a domain type that does not import Firebase, React, Next.js, or Polkadot types.

```ts
export type PointsReferendumStatus = 'Submitted' | 'Deciding' | 'Confirmed' | 'Rejected' | 'Cancelled';

export interface PointsReferendum {
	id: string; // Firestore document ID; normally String(index)
	index: number; // stable public route identifier
	title: string;
	content: string;
	authorUid: string;
	authorDisplayName: string;
	origin: string; // reuse a supported EPostOrigin at the app boundary
	status: PointsReferendumStatus;
	tags: string[];
	topic?: string;
	votingStartsAt: Date;
	votingEndsAt: Date;
	approvalThresholdBps: number;
	minimumTurnoutPoints: number;
	createdAt: Date;
	updatedAt: Date;
	closedAt?: Date;
}

export type PointsVoteDecision = 'aye' | 'nay' | 'abstain';

export interface PointsReferendumVote {
	referendumId: string;
	referendumIndex: number;
	uid: string;
	voterDisplayName: string;
	decision: PointsVoteDecision;
	pointsUsed: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface PointsReferendumStats {
	ayePoints: number;
	nayPoints: number;
	abstainPoints: number;
	ayeVoters: number;
	nayVoters: number;
	abstainVoters: number;
	totalVoters: number;
	updatedAt: Date;
}
```

Validate points as safe non-negative integers. If the product may exceed JavaScript's
safe integer range, store decimal strings and use `bigint` in domain calculations. Do
not mix both representations.

## 8. Firestore Data Model

```text
referenda/{index}
referenda/{index}/votes/{uid}
referenda/{index}/stats/current
counters/referenda
```

Recommended referendum document:

```ts
{
  index: 42,
  title: '...',
  content: '...',
  authorUid: 'firebase-uid',
  authorDisplayName: 'Alice',
  origin: 'Root',
  status: 'Deciding',
  tags: [],
  votingStartsAt: Timestamp,
  votingEndsAt: Timestamp,
  approvalThresholdBps: 5000,
  minimumTurnoutPoints: 1,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  schemaVersion: 1
}
```

Recommended vote document:

```ts
{
  uid: 'firebase-uid',
  voterDisplayName: 'Alice',
  decision: 'aye',
  pointsUsed: 100,
  balanceAtVote: 1000,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  schemaVersion: 1
}
```

Recommended aggregate document:

```ts
{
  ayePoints: 100,
  nayPoints: 20,
  abstainPoints: 5,
  ayeVoters: 1,
  nayVoters: 1,
  abstainVoters: 1,
  totalVoters: 3,
  updatedAt: Timestamp,
  schemaVersion: 1
}
```

Allocate numeric indexes by transactionally incrementing `counters/referenda.nextIndex`.
Never derive the next index from a collection count or a “last document” query.

Required composite indexes should be checked in through `firestore.indexes.json`. At a
minimum, plan for:

- `referenda`: `status ASC, createdAt DESC`
- `referenda`: `origin ASC, createdAt DESC`
- `referenda`: `status ASC, origin ASC, createdAt DESC` if filters can be combined
- collection group `votes`: `uid ASC, updatedAt DESC` if profile vote history is included

Only add indexes required by real queries and emulator tests.

## 9. API Contracts

All date fields are ISO strings at the HTTP boundary. All failures use the project's
standard API error shape.

### 9.1 List referenda

```http
GET /api/v2/referenda?page=1&limit=20&status=Deciding&origin=Root
```

Response:

```ts
{
  items: ReferendumListingView[];
  totalCount: number;
}
```

The listing view must contain enough normalized data for `ListingCard`: index, title,
author, created time, origin, status, voting end time, comment count, and point metrics.

### 9.2 Referendum detail

```http
GET /api/v2/referenda/{index}
```

Return a normalized detail view. It may be adapted to `IPost` for initial reuse, but the
adapter must clearly document which `onChainInfo` fields are compatibility fields and
must not invent chain hashes, blocks, deposits, or beneficiaries.

### 9.3 Current user's vote

```http
GET /api/v2/referenda/{index}/votes/me
Authorization: Bearer <Firebase ID token>
```

Return `{ vote: PointsReferendumVote | null }`.

### 9.4 Vote history

```http
GET /api/v2/referenda/{index}/votes?page=1&limit=20&decision=aye
```

Public history should expose only fields approved for public display. Do not return
email addresses or private profile data.

### 9.5 Create or change a vote

```http
PUT /api/v2/referenda/{index}/votes/me
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{
  "decision": "aye",
  "pointsUsed": 100
}
```

Use PUT because the vote has a stable identity: `{referendumId, uid}`. The operation is
idempotent for an identical payload.

### 9.6 Remove a vote

```http
DELETE /api/v2/referenda/{index}/votes/me
Authorization: Bearer <Firebase ID token>
```

### 9.7 Stats

```http
GET /api/v2/referenda/{index}/stats
```

The browser may listen directly to `referenda/{index}/stats/current` for realtime UI if
security rules allow public read. All writes remain server-only.

## 10. Transaction Algorithm

Vote create, update, and removal must share one domain/service implementation.

### 10.1 Create or update

Inside one Firestore transaction:

1. Read the referendum, authenticated user's profile, existing vote, and current stats.
2. Validate that all reads happen before writes.
3. Require referendum status `Deciding` and current server time inside the voting window.
4. Require `pointsUsed` to be an integer and `1 <= pointsUsed <= pointsBalance`.
5. Validate decision against `aye | nay | abstain`.
6. If an existing vote exists, subtract its old points and voter count from the old
   decision bucket.
7. Add the new points and voter count to the new decision bucket.
8. Reject any result that would make a counter negative.
9. Upsert the vote and stats documents with server timestamps.

Do not use a read-modify-write outside the transaction. Do not update the vote first and
repair aggregates later with a trigger.

### 10.2 Remove

Inside one transaction:

1. Read referendum, existing vote, and stats.
2. Validate that voting is still open.
3. If no vote exists, either return idempotent success or a consistent 404; choose once
   and test it. Idempotent success is preferred.
4. Subtract the old vote from its decision bucket and total voter count.
5. Delete the vote and update stats.

### 10.3 Concurrency

Tests must cast and change votes concurrently from multiple users. The final stats must
equal a fresh aggregation of all vote documents. Transaction retries must not duplicate
voter counts.

## 11. Authentication and Security Rules

Use the Firebase ID token verification pattern already used by DemoOS API routes. The
route derives `uid` from the verified token and reads `users/{uid}` server-side.

Minimum Firestore intent:

```text
referenda: public read; no direct client write
referenda/*/stats: public read; no direct client write
referenda/*/votes: no collection-wide client read; own vote read only if needed;
                   no direct client write
users: expose only the minimum profile reads required by current UI;
       points and roles are never client-writable
```

Rules must be implemented in `firestore.rules`, referenced from `firebase.json`, and
covered with `@firebase/rules-unit-testing` against the emulator. Admin SDK tests alone
do not validate rules.

Required denial tests:

- anonymous direct vote write
- authenticated direct vote write
- client stats write
- client `pointsBalance` update
- non-admin lifecycle/status update
- reading another user's private vote path, if votes are private

Required allow tests:

- public referendum and stats read
- authenticated own-vote read, if the UI uses direct reads
- intended public vote-history query, only if explicitly supported

## 12. UI Implementation Strategy

### 12.1 Route boundary

Change the current redirect guards into explicit branches:

```tsx
if (isBlockchainEnabled) {
	return <ChainReferendaPage />;
}

return <PointsReferendaPage />;
```

If imports pull chain code into the DemoOS bundle, move the original page body unchanged
to `ChainReferendaPage.tsx`/`ChainReferendumDetailsPage.tsx` and dynamically import it.
The thin route wrapper chooses the implementation.

Use the server flag `ENABLE_BLOCKCHAIN` for server routing and the public flag only for
client presentation selection. Keep both values aligned in deployment configuration.

### 12.2 Listing

- Return a normalized `IPostListing`-compatible view from the provider/adapter.
- Reuse `ListingPage`, `ListingTab`, and `ListingCard`.
- Add a formatter strategy or `votingUnit` prop so tooltips display `120 points`, not a
  network token or USD conversion.
- Preserve status and origin filters, pagination, loading state, responsive layout, and
  card navigation.
- Hide the analytics tab until points-native analytics exist. Do not call chain analytics
  endpoints and render empty charts.
- The create button must route to an implemented DemoOS referendum creation flow or be
  hidden behind an explicit capability flag. It must not route users into a wallet flow.

### 12.3 Detail

Reuse the two/three-column layout, header, content, comments, status, period display,
vote call-to-action, summary, and history.

For DemoOS, exclude:

- On-chain info tab when it has no meaningful points equivalent
- decision deposit
- refund deposits
- beneficiaries and payout
- OpenGov threshold curves
- OG tracker if it depends on chain references

Introduce a capabilities object instead of repeated mode checks:

```ts
type ReferendumCapabilities = {
	canVote: boolean;
	canChangeVote: boolean;
	canRemoveVote: boolean;
	showOnChainInfo: boolean;
	showDeposits: boolean;
	showCurveGraph: boolean;
	showPointStats: boolean;
};
```

### 12.4 Voting dialog

Create `PointsReferendumVote.tsx` rather than adding a large environment branch inside
the existing chain component.

The points dialog should:

1. Require Firebase login.
2. Display current `pointsBalance`.
3. Let the user select Aye, Nay, or Abstain using the existing choice UI.
4. Accept an integer points amount with a “Use max” shortcut.
5. Show inline errors for zero, non-integer, over-balance, closed referendum, and stale
   balance.
6. Load and display an existing vote.
7. Submit with a disabled/loading state that prevents duplicate clicks.
8. Refresh/invalidate current vote, stats, detail, listing, and profile vote-history
   queries after success.
9. Reuse the success modal and optional comment-after-vote interaction.

The success summary should show decision, points used, and the Firebase display name. It
must not show wallet address, DOT unit, conviction, or lock duration.

### 12.5 Realtime results

Subscribe only to the aggregate stats document, not the entire votes collection. This
keeps reads bounded and prevents leaking individual votes.

- Initialize the listener once per referendum.
- Unsubscribe on unmount.
- Handle permission and missing-document errors with a visible fallback.
- Use the initial server response for SSR/hydration, then merge realtime updates.
- Avoid changing date or numeric serialization between server and first client render.

## 13. Referendum Creation and Administration

Implement this after read and vote flows are stable unless the product requires user
creation in the first slice.

Recommended first policy:

- Authenticated users may create a draft/submitted referendum through a trusted API.
- The server assigns author fields and the numeric index.
- Input validation covers title, content, origin allowlist, start/end times, thresholds,
  tags, and maximum lengths.
- Only administrators may cancel, force-close, or edit lifecycle fields after voting
  starts.
- A scheduled Function or idempotent trusted endpoint closes expired referenda and writes
  the final status using the stored aggregate and thresholds.

If creation is not part of the first delivery, explicitly hide the create CTA in DemoOS
mode and provide emulator seed fixtures. Never leave a button that enters the existing
chain extrinsic flow.

## 14. Query Keys and Client Cache

Define stable keys rather than reusing chain keys with incompatible result types:

```ts
['points-referenda', filters][('points-referendum', index)][('points-referendum-vote', index, uid)][('points-referendum-stats', index)][
	('points-referendum-votes', index, page, decision)
];
```

On vote mutation success:

- update the current-vote cache optimistically only after the server accepts the vote,
  or implement a rollback-safe optimistic mutation;
- update stats from the server response, then allow the realtime listener to reconcile;
- invalidate listing/detail caches that contain vote metrics;
- do not mutate chain Referenda cache keys.

## 15. Testing Plan

### 15.1 Pure unit tests

- outcome calculation at below/equal/above threshold
- abstain behavior
- zero Aye+Nay denominator
- points validation and safe-integer bounds
- view-model mapping from Firestore domain model to listing/detail UI
- capability selection for both feature-flag values

### 15.2 Repository tests against Firestore emulator

- numeric index allocation is unique under concurrency
- filter and pagination ordering
- Timestamp serialization
- missing referendum and stats initialization
- vote create/update/remove aggregate correctness
- simultaneous vote transactions

### 15.3 API integration tests

- anonymous mutation returns 401
- malformed decision/points returns 400
- insufficient balance returns 403
- missing referendum returns 404
- non-votable status or expired window returns 409/failed precondition
- create, change decision, change amount, and remove vote
- identity spoofing in request body has no effect
- current vote and public history privacy

### 15.4 Security-rule tests

Implement all allow/deny cases from section 11.

### 15.5 Component tests

- DemoOS route does not redirect
- login gate
- balance display and max button
- unsupported vote modes absent
- over-balance validation
- existing vote edit/remove state
- success/error/loading behavior
- point unit formatting in list, detail, summary, and history

### 15.6 Regression tests for chain mode

With `ENABLE_BLOCKCHAIN=true`:

- listing and detail use the original APIs
- wallet selector and conviction controls still render
- voting still calls the Polkadot transaction service
- DOT formatting remains unchanged
- no Firebase points vote API is called

With `ENABLE_BLOCKCHAIN=false`:

- no wallet, RPC, indexer, or Polkadot service initializes
- listing/detail/voting work using Firebase emulators
- a missing Algolia/Redis/Subscan key does not break the flow

## 16. Implementation Phases and PR Boundaries

Keep PRs reviewable. Do not implement the entire milestone in one large diff.

### Phase 0: Contract and fixtures

- Add domain entities, outcome calculation, ports, DTOs, and emulator seed data.
- Add unit tests for calculations and mapping.
- No route behavior change yet.

### Phase 1: Read path

- Add Firestore referendum repository.
- Add listing/detail APIs and adapters.
- Change `/referenda` and `/referenda/{index}` to provider wrappers.
- Reuse listing/detail UI with chain-only panels disabled through capabilities.
- Add repository/API/component tests.

### Phase 2: Points voting

- Add the transactional vote service and endpoints.
- Add `PointsReferendumVote`, current-vote status, summary, and realtime aggregate.
- Add concurrency, validation, authentication, and UI tests.

### Phase 3: Rules and indexes

- Check in `firestore.rules` and `firestore.indexes.json`.
- Reference both from `firebase.json`.
- Add rules-unit tests and an emulator CI command.
- This phase is mandatory before deployment and may be developed alongside Phases 1–2.

### Phase 4: Creation and lifecycle

- Add trusted creation/index allocation.
- Add admin cancellation/closure.
- Add scheduled finalization and deterministic outcome tests.
- Wire or hide the create CTA according to delivered capability.

### Phase 5: Parity polish

- Profile vote history and activity feed
- points-native bubble/history visualizations
- accessibility, responsive behavior, empty states, localization
- performance/read-cost audit

## 17. AI Agent Working Procedure

Every AI Agent assigned to this milestone must follow this sequence:

1. Read `docs/AGENTS.md`, this entire guide, and the existing files listed in section 4.
2. State the exact phase and acceptance criteria being implemented.
3. Inspect `git status` and preserve unrelated user changes.
4. Search for an existing component/service before creating a duplicate.
5. Add new DemoOS files beside original chain files.
6. If an original page needs branching, keep the original body intact in a chain
   implementation component and add a thin provider wrapper.
7. Implement domain rules and tests before wiring presentation.
8. Use verified Firebase auth and transactions for every mutation.
9. Run focused tests, Functions build, type checking/linting, and the no-chain build
   appropriate to the changed phase.
10. Inspect `git diff --stat` and `git diff` for accidental upstream deletions.
11. Update this guide and architecture/data-model documentation if the implementation
    contract changes.
12. Report what was verified and what was not; never claim emulator or chain-mode
    validation without running it.

### Required PR description

Each PR must state:

- phase and scope
- files/components reused from chain Referenda
- new DemoOS-specific files
- data model/API/rules changes
- feature-flag behavior in both modes
- tests run and results
- known omissions and next phase

## 18. Definition of Done

The points-based Referenda milestone is complete only when all of the following are true:

- `/referenda` and `/referenda/{index}` work with `ENABLE_BLOCKCHAIN=false`.
- List/detail UI substantially matches chain mode without exposing false chain concepts.
- Authenticated users can cast, change, and remove Aye/Nay/Abstain votes using an integer
  amount no greater than `pointsBalance`.
- Vote writes and aggregates are transactionally consistent under concurrency.
- Results update in realtime from the aggregate document.
- Closed/cancelled/expired referenda reject voting server-side and disable it client-side.
- Firestore rules prevent direct mutation of votes, stats, balances, and lifecycle fields.
- Required indexes and emulator tests are checked in.
- No-chain mode initializes no Polkadot, wallet, RPC, or indexer dependency.
- Chain mode retains its original wallet, DOT, conviction, and transaction behavior.
- Creation CTA is either connected to a working DemoOS flow or intentionally hidden.
- Documentation matches implemented routes, schemas, flags, and product rules.
- Relevant unit, integration, rules, component, build, and regression checks pass.

## 19. Explicitly Out of Scope for the First Release

- DOT or any transferable token
- conviction multipliers and lock periods
- delegation and delegated voting power
- split/split-abstain voting
- wallet/address voting identity
- decision deposits, preimages, enactment, treasury payout, and refund flows
- chain-derived approval/support curves
- cross-network point balances
- notifications/subscriptions unless separately approved

These may be added later through new capabilities. Do not keep dormant chain imports in
the DemoOS path in anticipation of them.
