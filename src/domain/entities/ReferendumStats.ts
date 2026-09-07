// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Aggregated, point-weighted results for a referendum.
 *
 * Stored (and kept transactionally consistent) at `referenda/{index}/stats/current`.
 *
 * Abstain points count toward turnout but NOT the approval denominator.
 * approval = ayePoints / (ayePoints + nayPoints); zero when the denominator is zero.
 */
export interface ReferendumStats {
	ayePoints: number;
	nayPoints: number;
	abstainPoints: number;
	ayeVoters: number;
	nayVoters: number;
	abstainVoters: number;
	/** Unique voters, one per UID. Equal to ayeVoters + nayVoters + abstainVoters. */
	totalVoters: number;
	/** Server timestamp of the last stats update (ISO string). */
	updatedAt: string;
	/** Schema version for forward/backward compatibility. */
	schemaVersion: number;
}

/**
 * Participants / turnout breakdown used for the outcome decision.
 */
export function participatingPoints(stats: Pick<ReferendumStats, 'ayePoints' | 'nayPoints' | 'abstainPoints'>): number {
	return stats.ayePoints + stats.nayPoints + stats.abstainPoints;
}

/**
 * Approval ratio in basis points: ayePoints / (ayePoints + nayPoints).
 * Returns 0 when the denominator is zero.
 */
export function approvalBps(stats: Pick<ReferendumStats, 'ayePoints' | 'nayPoints'>): number {
	const denominator = stats.ayePoints + stats.nayPoints;
	if (denominator === 0) return 0;
	return Math.round((stats.ayePoints / denominator) * 10000);
}
