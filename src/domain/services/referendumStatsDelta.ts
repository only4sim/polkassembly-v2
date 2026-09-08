// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Pure, production stats-delta functions for points-based referenda (PR-3).
 *
 * These are the single authoritative implementations consumed by the trusted
 * service inside Firestore transactions. There is deliberately NO test-local
 * copy: `referendumStatsDelta.test.ts` tests this module directly.
 *
 * Frozen contract (PR-3):
 *  - Every input and result is a non-negative safe integer.
 *  - Adding a vote increments `totalVoters` and exactly one decision bucket.
 *  - Removing a vote that the stats cannot cover throws `StatsCorruptionError`
 *    (never clamps to zero — audit: corrupt aggregates must be rejected).
 *  - Invariant: `totalVoters === ayeVoters + nayVoters + abstainVoters`.
 *  - `abstainPoints` counts toward turnout, never toward the approval denominator
 *    (the denominator is computed downstream from `ayePoints`/`nayPoints` only).
 */

import { ReferendumDecision } from '../entities/Referendum';
import { type ReferendumStats } from '../entities/ReferendumStats';
import { type ReferendumVote } from '../entities/ReferendumVote';
import { STATS_SCHEMA_VERSION } from '../fixtures/referendaFixtures';

/** Thrown when the stored aggregate cannot safely absorb a delta. */
export class StatsCorruptionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StatsCorruptionError';
	}
}

function assertSafeNonNegative(value: number, label: string): void {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
		throw new StatsCorruptionError(`corrupt stats: ${label} must be a non-negative safe integer (got ${String(value)})`);
	}
}

function assertConsistent(stats: ReferendumStats): void {
	assertSafeNonNegative(stats.ayePoints, 'ayePoints');
	assertSafeNonNegative(stats.nayPoints, 'nayPoints');
	assertSafeNonNegative(stats.abstainPoints, 'abstainPoints');
	assertSafeNonNegative(stats.ayeVoters, 'ayeVoters');
	assertSafeNonNegative(stats.nayVoters, 'nayVoters');
	assertSafeNonNegative(stats.abstainVoters, 'abstainVoters');
	assertSafeNonNegative(stats.totalVoters, 'totalVoters');
	const bucketVoters = stats.ayeVoters + stats.nayVoters + stats.abstainVoters;
	if (stats.totalVoters !== bucketVoters) {
		throw new StatsCorruptionError(`corrupt stats: totalVoters (${stats.totalVoters}) != decision voter sum (${bucketVoters})`);
	}
}

function assertSafePointValue(points: number): void {
	if (typeof points !== 'number' || !Number.isSafeInteger(points) || points < 1) {
		throw new StatsCorruptionError(`corrupt delta: pointsUsed must be a safe integer >= 1 (got ${String(points)})`);
	}
}

/** Returns a new stats object with one vote's contribution added. */
export function addVoteContribution(stats: ReferendumStats, decision: ReferendumDecision, points: number): ReferendumStats {
	assertConsistent(stats);
	assertSafePointValue(points);
	const next = { ...stats };
	next.totalVoters += 1;
	if (decision === ReferendumDecision.AYE) {
		next.ayePoints += points;
		next.ayeVoters += 1;
	} else if (decision === ReferendumDecision.NAY) {
		next.nayPoints += points;
		next.nayVoters += 1;
	} else if (decision === ReferendumDecision.ABSTAIN) {
		next.abstainPoints += points;
		next.abstainVoters += 1;
	} else {
		throw new StatsCorruptionError(`corrupt delta: unknown decision ${String(decision)}`);
	}
	assertConsistent(next);
	return next;
}

/** Returns a new stats object with one vote's contribution removed. Throws on any state it cannot cover. */
export function removeVoteContribution(stats: ReferendumStats, decision: ReferendumDecision, points: number): ReferendumStats {
	assertConsistent(stats);
	assertSafePointValue(points);
	const next = { ...stats };
	if (next.totalVoters < 1) {
		throw new StatsCorruptionError('corrupt stats: totalVoters would go negative');
	}
	if (decision === ReferendumDecision.AYE) {
		if (next.ayePoints < points || next.ayeVoters < 1) {
			throw new StatsCorruptionError('corrupt stats: aye counters cannot cover the removed vote');
		}
		next.ayePoints -= points;
		next.ayeVoters -= 1;
	} else if (decision === ReferendumDecision.NAY) {
		if (next.nayPoints < points || next.nayVoters < 1) {
			throw new StatsCorruptionError('corrupt stats: nay counters cannot cover the removed vote');
		}
		next.nayPoints -= points;
		next.nayVoters -= 1;
	} else if (decision === ReferendumDecision.ABSTAIN) {
		if (next.abstainPoints < points || next.abstainVoters < 1) {
			throw new StatsCorruptionError('corrupt stats: abstain counters cannot cover the removed vote');
		}
		next.abstainPoints -= points;
		next.abstainVoters -= 1;
	} else {
		throw new StatsCorruptionError(`corrupt delta: unknown decision ${String(decision)}`);
	}
	next.totalVoters -= 1;
	assertConsistent(next);
	return next;
}

/**
 * Computes the next aggregate for a create-or-change vote write.
 * `previous` is the voter's existing vote (null when first voting).
 * Idempotent identical PUTs cancel out exactly: remove(old) then add(new).
 */
export function applyVoteDelta(stats: ReferendumStats, previous: ReferendumVote | null, next: { decision: ReferendumDecision; pointsUsed: number }): ReferendumStats {
	const intermediate = previous ? removeVoteContribution(stats, previous.decision, previous.pointsUsed) : stats;
	return addVoteContribution(intermediate, next.decision, next.pointsUsed);
}

/** Returns a new stats object with a single vote's contribution removed (removal path). */
export function subtractVote(stats: ReferendumStats, previous: ReferendumVote): ReferendumStats {
	return removeVoteContribution(stats, previous.decision, previous.pointsUsed);
}

/** Initial zeroed aggregate (schema-versioned) used when seeding a new referendum. */
export function emptyReferendumStats(): ReferendumStats {
	return {
		ayePoints: 0,
		nayPoints: 0,
		abstainPoints: 0,
		ayeVoters: 0,
		nayVoters: 0,
		abstainVoters: 0,
		totalVoters: 0,
		updatedAt: new Date(0).toISOString(),
		schemaVersion: STATS_SCHEMA_VERSION
	};
}
