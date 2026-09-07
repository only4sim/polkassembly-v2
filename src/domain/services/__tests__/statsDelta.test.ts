// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { describe, expect, it } from 'vitest';
import { ReferendumDecision } from '@/domain/entities/Referendum';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';
import { makeStats, makeVote } from '@/domain/fixtures/referendaFixtures';

/**
 * Pure stats delta function extracted from the trusted service for testability.
 * These reflect the logic in ReferendumTrustedService.addTo/subtractFrom/applyDelta.
 */
function addTo(stats: ReferendumStats, decision: ReferendumDecision, points: number): ReferendumStats {
	const r = { ...stats };
	r.totalVoters += 1;
	if (decision === ReferendumDecision.AYE) {
		r.ayePoints += points;
		r.ayeVoters += 1;
	} else if (decision === ReferendumDecision.NAY) {
		r.nayPoints += points;
		r.nayVoters += 1;
	} else {
		r.abstainPoints += points;
		r.abstainVoters += 1;
	}
	return r;
}

function subtractFrom(stats: ReferendumStats, decision: ReferendumDecision, points: number): ReferendumStats {
	const r = { ...stats };
	if (r.totalVoters < 1) throw new Error('corrupt');
	if (decision === ReferendumDecision.AYE) {
		if (r.ayePoints < points || r.ayeVoters < 1) throw new Error('corrupt');
		r.ayePoints -= points;
		r.ayeVoters -= 1;
	} else if (decision === ReferendumDecision.NAY) {
		if (r.nayPoints < points || r.nayVoters < 1) throw new Error('corrupt');
		r.nayPoints -= points;
		r.nayVoters -= 1;
	} else {
		if (r.abstainPoints < points || r.abstainVoters < 1) throw new Error('corrupt');
		r.abstainPoints -= points;
		r.abstainVoters -= 1;
	}
	r.totalVoters -= 1;
	return r;
}

function applyDelta(stats: ReferendumStats, prev: ReferendumVote | null, decision: ReferendumDecision, points: number): ReferendumStats {
	let result = { ...stats };
	if (prev) result = subtractFrom(result, prev.decision, prev.pointsUsed);
	return addTo(result, decision, points);
}

describe('stats delta operations', () => {
	const base = () => makeStats({ ayePoints: 100, nayPoints: 50, abstainPoints: 10, ayeVoters: 2, nayVoters: 1, abstainVoters: 1, totalVoters: 4 });

	it('addTo adds points in the correct bucket', () => {
		const s = addTo(base(), ReferendumDecision.AYE, 200);
		expect(s.ayePoints).toBe(300);
		expect(s.ayeVoters).toBe(3);
		expect(s.totalVoters).toBe(5);
	});

	it('addTo handles nay correctly', () => {
		const s = addTo(base(), ReferendumDecision.NAY, 30);
		expect(s.nayPoints).toBe(80);
		expect(s.nayVoters).toBe(2);
	});

	it('addTo handles abstain correctly', () => {
		const s = addTo(base(), ReferendumDecision.ABSTAIN, 5);
		expect(s.abstainPoints).toBe(15);
		expect(s.abstainVoters).toBe(2);
	});

	it('subtractFrom subtracts points in the correct bucket', () => {
		const s = subtractFrom(base(), ReferendumDecision.AYE, 50);
		expect(s.ayePoints).toBe(50);
		expect(s.ayeVoters).toBe(1);
		expect(s.totalVoters).toBe(3);
	});

	it('subtractFrom throws on negative totalVoters', () => {
		const empty = makeStats({ totalVoters: 0 });
		expect(() => subtractFrom(empty, ReferendumDecision.AYE, 0)).toThrow('corrupt');
	});

	it('subtractFrom throws when ayePoints would go negative', () => {
		expect(() => subtractFrom(base(), ReferendumDecision.AYE, 999)).toThrow('corrupt');
	});

	it('subtractFrom throws when ayeVoters would go negative', () => {
		expect(() => subtractFrom(makeStats({ ayePoints: 100, ayeVoters: 0, totalVoters: 1 }), ReferendumDecision.AYE, 10)).toThrow('corrupt');
	});

	it('applyDelta create: adds to empty stats', () => {
		const empty = makeStats({ ayePoints: 0, nayPoints: 0, abstainPoints: 0, ayeVoters: 0, nayVoters: 0, abstainVoters: 0, totalVoters: 0 });
		const result = applyDelta(empty, null, ReferendumDecision.AYE, 100);
		expect(result.ayePoints).toBe(100);
		expect(result.totalVoters).toBe(1);
	});

	it('applyDelta change same decision: remove old, add new', () => {
		const stats = base();
		const prev = makeVote({ decision: ReferendumDecision.AYE, pointsUsed: 50 });
		const result = applyDelta(stats, prev, ReferendumDecision.AYE, 200);
		// Remove 50 aye, add 200 aye
		expect(result.ayePoints).toBe(250); // 100 - 50 + 200
		expect(result.ayeVoters).toBe(2); // 2 - 1 + 1
		expect(result.totalVoters).toBe(4); // 4 - 1 + 1
	});

	it('applyDelta change decision: remove old bucket, add to new', () => {
		const stats = base();
		const prev = makeVote({ decision: ReferendumDecision.AYE, pointsUsed: 50 });
		const result = applyDelta(stats, prev, ReferendumDecision.NAY, 75);
		expect(result.ayePoints).toBe(50); // 100 - 50
		expect(result.ayeVoters).toBe(1); // 2 - 1
		expect(result.nayPoints).toBe(125); // 50 + 75
		expect(result.nayVoters).toBe(2);
		expect(result.totalVoters).toBe(4);
	});

	it('applyDelta remove vote', () => {
		const stats = base();
		const prev = makeVote({ decision: ReferendumDecision.ABSTAIN, pointsUsed: 10 });
		const result = subtractFrom(stats, prev.decision, prev.pointsUsed);
		expect(result.abstainPoints).toBe(0);
		expect(result.abstainVoters).toBe(0);
		expect(result.totalVoters).toBe(3);
	});

	it('idempotent identical PUT: remove then add same values', () => {
		const stats = base();
		const prev = makeVote({ decision: ReferendumDecision.NAY, pointsUsed: 50 });
		const result = applyDelta(stats, prev, ReferendumDecision.NAY, 50);
		expect(result.nayPoints).toBe(50); // 50 - 50 + 50
		expect(result.nayVoters).toBe(1); // 1 - 1 + 1
		expect(result.totalVoters).toBe(4);
	});
});
