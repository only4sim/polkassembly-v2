// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Lifecycle status of a points-based referendum.
 *
 * - `Submitted`: created, not yet votable.
 * - `Deciding`: active voting window (votingStartsAt <= now <= votingEndsAt).
 * - `Confirmed`: finalization decided it passed.
 * - `Rejected`: finalization decided it failed (or timed out without quorum).
 * - `Cancelled`: an administrator cancelled it.
 */
export enum ReferendumStatus {
	Submitted = 'Submitted',
	Deciding = 'Deciding',
	Confirmed = 'Confirmed',
	Rejected = 'Rejected',
	Cancelled = 'Cancelled'
}

/**
 * Voting decision for the first release: aye, nay, abstain.
 * `split` / `splitAbstain` are explicitly out of scope.
 */
export enum ReferendumDecision {
	AYE = 'aye',
	NAY = 'nay',
	ABSTAIN = 'abstain'
}

/**
 * Allowed subject origins for a points-based referendum. The allowlist prevents
 * free-form chain origin strings that have no meaning off-chain.
 */
export const REFERENDA_ORIGINS = [
	'root',
	'whitelisted_caller',
	'general_admin',
	'referendum_admin',
	'fellowship_admin',
	'technical_admin',
	'general_staking_admin',
	'treasurer',
	'small_tipper',
	'big_tipper'
] as const;

export type ReferendumOrigin = (typeof REFERENDA_ORIGINS)[number];

/** Throttle/safety limits for user-supplied fields. */
export const REFERENDUM_LIMITS = {
	MAX_TITLE_LENGTH: 120,
	MAX_CONTENT_LENGTH: 20000,
	MAX_TAGS: 10,
	MIN_TITLE_LENGTH: 4,
	MIN_CONTENT_LENGTH: 10
} as const;

/**
 * Domain entity for a points-based referendum.
 *
 * Stored in Firestore at `referenda/{index}`.
 *
 * Conventions:
 * - `index` is a stable, transactionally allocated numeric identifier.
 * - `approvalThresholdBps` is the minimum approval (ayePoints/(ayePoints+nayPoints))
 *   expressed in basis points (e.g. 5000 == 50%).
 * - `minimumTurnoutPoints` is the minimum participating point total required.
 * - `status` transitions through the lifecycle handled by trusted services.
 */
export interface Referendum {
	/** Stable numeric index, transactionally allocated from counters/referenda. */
	index: number;
	title: string;
	content: string;
	/** Firebase Auth UID of the author (server-derived, never client-supplied). */
	authorUid: string;
	authorDisplayName: string;
	origin: ReferendumOrigin;
	status: ReferendumStatus;
	tags: string[];
	/** ISO-8601 instant (UTC) when voting opens. */
	votingStartsAt: string;
	/** ISO-8601 instant (UTC) when voting closes. */
	votingEndsAt: string;
	/** Minimum approval required to pass, in basis points. */
	approvalThresholdBps: number;
	/** Minimum participating points required to pass. */
	minimumTurnoutPoints: number;
	createdAt: string;
	updatedAt: string;
	/** Set when the referendum is finalised or cancelled. */
	closedAt?: string;
	/** Schema version for forward/backward compatibility. */
	schemaVersion: number;
}
