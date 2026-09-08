// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Tests for the PRODUCTION stats-delta module (`referendumStatsDelta.ts`).
 * These are the same implementations the trusted service runs inside its
 * Firestore transactions — there is deliberately no test-local copy (PR-3).
 */

import { describe, expect, it } from 'vitest';
import { ReferendumDecision } from '@/domain/entities/Referendum';
import { makeStats, makeVote } from '@/domain/fixtures/referendaFixtures';
import { addVoteContribution, applyVoteDelta, emptyReferendumStats, removeVoteContribution, StatsCorruptionError, subtractVote } from '@/domain/services/referendumStatsDelta';

const base = () => makeStats({ ayePoints: 100, nayPoints: 50, abstainPoints: 10, ayeVoters: 2, nayVoters: 1, abstainVoters: 1, totalVoters: 4 });

describe('addVoteContribution', () => {
	it('adds points in the aye bucket', () => {
		const s = addVoteContribution(base(), ReferendumDecision.AYE, 200);
		expect(s.ayePoints).toBe(300);
		expect(s.ayeVoters).toBe(3);
		expect(s.totalVoters).toBe(5);
	});

	it('adds points in the nay and abstain buckets', () => {
		expect(addVoteContribution(base(), ReferendumDecision.NAY, 30).nayPoints).toBe(80);
		expect(addVoteContribution(base(), ReferendumDecision.ABSTAIN, 5).abstainPoints).toBe(15);
	});

	it('rejects unknown decisions', () => {
		expect(() => addVoteContribution(base(), 'split' as never, 10)).toThrow(StatsCorruptionError);
	});

	it('rejects non-integer / unsafe / out-of-range points', () => {
		expect(() => addVoteContribution(base(), ReferendumDecision.AYE, 0)).toThrow(StatsCorruptionError);
		expect(() => addVoteContribution(base(), ReferendumDecision.AYE, 1.5)).toThrow(StatsCorruptionError);
		expect(() => addVoteContribution(base(), ReferendumDecision.AYE, Number.MAX_SAFE_INTEGER + 1)).toThrow(StatsCorruptionError);
	});
});

describe('removeVoteContribution', () => {
	it('subtracts points from the correct bucket', () => {
		const s = removeVoteContribution(base(), ReferendumDecision.AYE, 50);
		expect(s.ayePoints).toBe(50);
		expect(s.ayeVoters).toBe(1);
		expect(s.totalVoters).toBe(3);
	});

	it('throws StatsCorruptionError when totalVoters is already zero', () => {
		const empty = makeStats({ totalVoters: 0, ayeVoters: 0, nayVoters: 0, abstainVoters: 0 });
		expect(() => removeVoteContribution(empty, ReferendumDecision.AYE, 1)).toThrow(StatsCorruptionError);
	});

	it('throws when the bucket points cannot cover the removed vote', () => {
		expect(() => removeVoteContribution(base(), ReferendumDecision.AYE, 999)).toThrow(StatsCorruptionError);
	});

	it('throws when the bucket voter count would go negative', () => {
		const stats = makeStats({ ayePoints: 100, ayeVoters: 0, nayPoints: 0, abstainPoints: 0, nayVoters: 0, abstainVoters: 0, totalVoters: 1 });
		expect(() => removeVoteContribution(stats, ReferendumDecision.AYE, 10)).toThrow(StatsCorruptionError);
	});

	it('throws on corrupted negative stored values', () => {
		const corrupt = makeStats({ ayePoints: -5, ayeVoters: 1, nayPoints: 0, nayVoters: 0, abstainPoints: 0, abstainVoters: 0, totalVoters: 1 });
		expect(() => removeVoteContribution(corrupt, ReferendumDecision.AYE, 1)).toThrow(StatsCorruptionError);
	});
});

describe('applyVoteDelta', () => {
	it('create: adds to empty stats', () => {
		const result = applyVoteDelta(emptyReferendumStats(), null, { decision: ReferendumDecision.AYE, pointsUsed: 100 });
		expect(result.ayePoints).toBe(100);
		expect(result.totalVoters).toBe(1);
	});

	it('same-decision amount change: remove old then add new', () => {
		const prev = makeVote({ decision: ReferendumDecision.AYE, pointsUsed: 50 });
		const result = applyVoteDelta(base(), prev, { decision: ReferendumDecision.AYE, pointsUsed: 200 });
		expect(result.ayePoints).toBe(250);
		expect(result.ayeVoters).toBe(2);
		expect(result.totalVoters).toBe(4);
	});

	it('decision change: removes the old bucket and fills the new one', () => {
		const prev = makeVote({ decision: ReferendumDecision.AYE, pointsUsed: 50 });
		const result = applyVoteDelta(base(), prev, { decision: ReferendumDecision.NAY, pointsUsed: 75 });
		expect(result.ayePoints).toBe(50);
		expect(result.ayeVoters).toBe(1);
		expect(result.nayPoints).toBe(125);
		expect(result.nayVoters).toBe(2);
		expect(result.totalVoters).toBe(4);
	});

	it('idempotent identical PUT cancels out exactly', () => {
		const prev = makeVote({ decision: ReferendumDecision.NAY, pointsUsed: 50 });
		const result = applyVoteDelta(base(), prev, { decision: ReferendumDecision.NAY, pointsUsed: 50 });
		expect(result.nayPoints).toBe(50);
		expect(result.nayVoters).toBe(1);
		expect(result.totalVoters).toBe(4);
	});

	it('propagates StatsCorruptionError from an unrecoverable previous state', () => {
		const corrupt = makeStats({ totalVoters: 0 });
		const prev = makeVote({ decision: ReferendumDecision.AYE, pointsUsed: 50 });
		expect(() => applyVoteDelta(corrupt, prev, { decision: ReferendumDecision.AYE, pointsUsed: 10 })).toThrow(StatsCorruptionError);
	});
});

describe('subtractVote', () => {
	it('removes the stored vote contribution', () => {
		const prev = makeVote({ decision: ReferendumDecision.ABSTAIN, pointsUsed: 10 });
		const result = subtractVote(base(), prev);
		expect(result.abstainPoints).toBe(0);
		expect(result.abstainVoters).toBe(0);
		expect(result.totalVoters).toBe(3);
	});
});

describe('emptyReferendumStats', () => {
	it('returns a consistent zeroed aggregate', () => {
		const e = emptyReferendumStats();
		expect(e.totalVoters).toBe(0);
		expect(e.ayePoints).toBe(0);
		expect(e.ayeVoters + e.nayVoters + e.abstainVoters).toBe(0);
	});
});
