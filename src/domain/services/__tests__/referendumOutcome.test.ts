// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { describe, expect, it } from 'vitest';
import { approvalBps, participatingPoints } from '@/domain/entities/ReferendumStats';
import { computeFinalOutcome, decideOutcome } from '@/domain/services/referendumOutcome';
import { ReferendumStatus } from '@/domain/entities/Referendum';
import { makeReferendum, makeStats } from '@/domain/fixtures/referendaFixtures';

describe('referendumStats helpers', () => {
	it('participatingPoints includes abstain', () => {
		expect(participatingPoints({ ayePoints: 100, nayPoints: 50, abstainPoints: 20 })).toBe(170);
	});

	it('approvalBps excludes abstain from the denominator', () => {
		// 100/(100+50) = 66.67% -> 6667 bps
		expect(approvalBps({ ayePoints: 100, nayPoints: 50 })).toBe(6667);
	});

	it('approvalBps returns 0 when the denominator is zero', () => {
		expect(approvalBps({ ayePoints: 0, nayPoints: 0 })).toBe(0);
	});

	it('handles full aye when there are no nay votes but abstains exist', () => {
		// abstain should NOT count toward the denominator
		expect(approvalBps({ ayePoints: 50, nayPoints: 0 })).toBe(10000);
	});
});

describe('decideOutcome boundary values', () => {
	it('passes when approval and turnout both meet thresholds', () => {
		const referendum = makeReferendum({ status: ReferendumStatus.Confirmed, approvalThresholdBps: 5000, minimumTurnoutPoints: 50 });
		const stats = makeStats({ ayePoints: 100, nayPoints: 50, abstainPoints: 20 }); // 66.67% approval, 170 turnout
		const result = decideOutcome(referendum, stats);
		expect(result.outcome).toBe('Confirmed');
		expect(result.passed).toBe(true);
	});

	it('rejects when approval is below threshold', () => {
		const referendum = makeReferendum({ status: ReferendumStatus.Rejected, approvalThresholdBps: 6000, minimumTurnoutPoints: 50 });
		const stats = makeStats({ ayePoints: 100, nayPoints: 90, abstainPoints: 0 }); // 52.6% approval
		const result = decideOutcome(referendum, stats);
		expect(result.outcome).toBe('Rejected');
		expect(result.passed).toBe(false);
	});

	it('rejects when turnout is below quorum even if approval is 100%', () => {
		const referendum = makeReferendum({ status: ReferendumStatus.Rejected, approvalThresholdBps: 5000, minimumTurnoutPoints: 1000 });
		const stats = makeStats({ ayePoints: 100, nayPoints: 0, abstainPoints: 0 });
		const result = decideOutcome(referendum, stats);
		expect(result.outcome).toBe('Rejected');
		expect(result.passed).toBe(false);
	});

	it('rejects when only abstains are present (approval denominator zero)', () => {
		const referendum = makeReferendum({ status: ReferendumStatus.Rejected, approvalThresholdBps: 5000, minimumTurnoutPoints: 1 });
		const stats = makeStats({ ayePoints: 0, nayPoints: 0, abstainPoints: 100 });
		const result = decideOutcome(referendum, stats);
		expect(result.approvalBps).toBe(0);
		expect(result.passed).toBe(false);
		expect(result.outcome).toBe('Rejected');
	});

	it('boundary: exactly at threshold passes', () => {
		const referendum = makeReferendum({ status: ReferendumStatus.Confirmed, approvalThresholdBps: 5000, minimumTurnoutPoints: 100 });
		// approval = 100/(100+100) = 5000 bps exactly; turnout = 200 >= 100
		const stats = makeStats({ ayePoints: 100, nayPoints: 100, abstainPoints: 0 });
		const result = decideOutcome(referendum, stats);
		expect(result.outcome).toBe('Confirmed');
	});

	it('throws on a Submitted referendum', () => {
		const referendum = makeReferendum({ status: ReferendumStatus.Submitted });
		expect(() => decideOutcome(referendum, makeStats())).toThrow(/Submitted/);
	});

	it('does not throw on Deciding (for finalization)', () => {
		const referendum = makeReferendum({ status: ReferendumStatus.Deciding, approvalThresholdBps: 5000, minimumTurnoutPoints: 50 });
		const stats = makeStats({ ayePoints: 100, nayPoints: 50, abstainPoints: 20 });
		const result = decideOutcome(referendum, stats);
		expect(result.outcome).toBe('Confirmed');
	});
});

describe('computeFinalOutcome pure function', () => {
	it('passes when approval and turnout both meet thresholds', () => {
		const result = computeFinalOutcome(5000, 50, makeStats({ ayePoints: 100, nayPoints: 50, abstainPoints: 20 }));
		expect(result.outcome).toBe('Confirmed');
		expect(result.passed).toBe(true);
	});

	it('rejects when approval is below threshold', () => {
		const result = computeFinalOutcome(6000, 50, makeStats({ ayePoints: 100, nayPoints: 90 }));
		expect(result.outcome).toBe('Rejected');
	});

	it('rejects when turnout is below quorum', () => {
		const result = computeFinalOutcome(5000, 1000, makeStats({ ayePoints: 100, nayPoints: 0 }));
		expect(result.outcome).toBe('Rejected');
	});

	it('rejects with zero denominator (only abstains)', () => {
		const result = computeFinalOutcome(5000, 1, makeStats({ ayePoints: 0, nayPoints: 0, abstainPoints: 100 }));
		expect(result.approvalBps).toBe(0);
		expect(result.passed).toBe(false);
		expect(result.outcome).toBe('Rejected');
	});

	it('passes at exact boundary', () => {
		const result = computeFinalOutcome(5000, 100, makeStats({ ayePoints: 100, nayPoints: 100 }));
		expect(result.outcome).toBe('Confirmed');
	});

	it('passes with 0 threshold and quorum met', () => {
		const result = computeFinalOutcome(0, 10, makeStats({ ayePoints: 5, nayPoints: 5 }));
		expect(result.outcome).toBe('Confirmed');
	});

	it('rejects 0 threshold but quorum not met', () => {
		const result = computeFinalOutcome(0, 100, makeStats({ ayePoints: 5, nayPoints: 5 }));
		expect(result.outcome).toBe('Rejected');
	});

	// Frozen contract (PR-1 / audit REF-MATH-01): the final decision uses exact
	// cross-multiplication, never the rounded display bps. These cases would
	// incorrectly pass with `Math.round`-based comparisons.
	it('rejects when rounded bps would meet the threshold but the exact ratio does not (1/6 case)', () => {
		// exact approval = 10000/6 ≈ 1666.67 bps; Math.round -> 1667
		// threshold 1667: rounded comparison would pass, exact must reject.
		const stats = makeStats({ ayePoints: 1, nayPoints: 5, abstainPoints: 0 });
		const result = computeFinalOutcome(1667, 1, stats);
		expect(result.approvalBps).toBe(1667);
		expect(result.passed).toBe(false);
		expect(result.outcome).toBe('Rejected');
	});

	it('rejects the audit 0.5 bps example (1/20000) at a 1 bps threshold', () => {
		// exact approval = 10000/20000 = 0.5 bps; Math.round(0.5) -> 1
		// threshold 1: rounded comparison would pass, exact must reject.
		const stats = makeStats({ ayePoints: 1, nayPoints: 19999, abstainPoints: 0 });
		const result = computeFinalOutcome(1, 1, stats);
		expect(result.approvalBps).toBe(1);
		expect(result.passed).toBe(false);
		expect(result.outcome).toBe('Rejected');
	});

	it('passes when the exact ratio equals the threshold (1/3 at 3333 bps)', () => {
		// exact approval = 10000/3 ≈ 3333.33 bps; threshold 3333 -> exact passes.
		const stats = makeStats({ ayePoints: 1, nayPoints: 2, abstainPoints: 0 });
		const result = computeFinalOutcome(3333, 1, stats);
		expect(result.passed).toBe(true);
		expect(result.outcome).toBe('Confirmed');
	});

	it('rejects at exactly one integer below the exact ratio (1/3 at 3334 bps)', () => {
		const stats = makeStats({ ayePoints: 1, nayPoints: 2, abstainPoints: 0 });
		const result = computeFinalOutcome(3334, 1, stats);
		expect(result.passed).toBe(false);
		expect(result.outcome).toBe('Rejected');
	});
});
