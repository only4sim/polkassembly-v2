// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

// Shared seed/seed fixture data for unit tests and emulator integration tests.

import { ReferendumDecision, ReferendumStatus, type Referendum } from '@/domain/entities/Referendum';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';

export const REFERENDUM_SCHEMA_VERSION = 1;
export const VOTE_SCHEMA_VERSION = 1;
export const STATS_SCHEMA_VERSION = 1;

export function makeReferendum(overrides: Partial<Referendum> = {}): Referendum {
	const votingStarts = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const votingEnds = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
	return {
		index: 1,
		title: 'Should we fund the treasury?',
		content: 'This is a sample points-based referendum body used for fixtures.',
		authorUid: 'author-uid',
		authorDisplayName: 'Author',
		origin: 'root',
		status: ReferendumStatus.Deciding,
		tags: ['treasury'],
		votingStartsAt: votingStarts,
		votingEndsAt: votingEnds,
		approvalThresholdBps: 5000,
		minimumTurnoutPoints: 50,
		createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
		updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
		schemaVersion: REFERENDUM_SCHEMA_VERSION,
		...overrides
	};
}

export function makeStats(overrides: Partial<ReferendumStats> = {}): ReferendumStats {
	return {
		ayePoints: 100,
		nayPoints: 50,
		abstainPoints: 20,
		ayeVoters: 3,
		nayVoters: 2,
		abstainVoters: 1,
		totalVoters: 6,
		updatedAt: new Date().toISOString(),
		schemaVersion: STATS_SCHEMA_VERSION,
		...overrides
	};
}

export function makeVote(overrides: Partial<ReferendumVote> = {}): ReferendumVote {
	return {
		uid: 'uid-1',
		voterDisplayName: 'Voter One',
		decision: ReferendumDecision.AYE,
		pointsUsed: 100,
		balanceAtVote: 1000,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		schemaVersion: VOTE_SCHEMA_VERSION,
		...overrides
	};
}
