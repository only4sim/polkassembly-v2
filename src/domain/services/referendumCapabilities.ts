// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { ReferendumStatus } from '../entities/Referendum';

/**
 * Pure capability derivation for a referendum (plan PR-6).
 *
 * The SERVER is the source of truth: the capabilities API route calls this with
 * the verified actor and the authoritative referendum data, and the UI only
 * consumes the server-provided result. Chain-only capabilities (deposits,
 * curves, wallet voting) are deliberately absent — points mode never renders
 * them.
 */
export interface ReferendumCapabilityInput {
	status: ReferendumStatus | string | undefined;
	now: Date;
	votingStartsAt: Date | undefined;
	votingEndsAt: Date | undefined;
	isAuthenticated: boolean;
	isAdmin: boolean;
}

export interface ReferendumCapabilities {
	/** Voting window is open right now (status Deciding AND startsAt <= now < endsAt). */
	isVotingOpen: boolean;
	/** Referendum has reached a terminal state (final or cancelled). */
	isClosed: boolean;
	canVote: boolean;
	canChangeVote: boolean;
	canRemoveVote: boolean;
	/** Admin-only, server-verified. */
	canCancel: boolean;
}

/**
 * Half-open window: `votingStartsAt <= now < votingEndsAt` — matching the
 * server-side validation contract exactly (PR-1).
 */
export function deriveReferendumCapabilities(input: ReferendumCapabilityInput): ReferendumCapabilities {
	const { status } = input;
	const nowMs = input.now.getTime();
	const startsOk = input.votingStartsAt ? nowMs >= input.votingStartsAt.getTime() : false;
	const endsOk = input.votingEndsAt ? nowMs < input.votingEndsAt.getTime() : false;
	const isVotingOpen = status === ReferendumStatus.Deciding && startsOk && endsOk;
	const isClosed = status === ReferendumStatus.Confirmed || status === ReferendumStatus.Rejected || status === ReferendumStatus.Cancelled;
	const canCancel = input.isAdmin && !isClosed && status !== undefined;

	return {
		isVotingOpen,
		isClosed,
		canVote: isVotingOpen && input.isAuthenticated,
		canChangeVote: isVotingOpen && input.isAuthenticated,
		canRemoveVote: isVotingOpen && input.isAuthenticated,
		canCancel
	};
}
