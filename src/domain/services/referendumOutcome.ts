// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { ReferendumStatus, type Referendum } from '../entities/Referendum';
import { approvalBps, participatingPoints, type ReferendumStats } from '../entities/ReferendumStats';

export type ReferendumOutcome = 'Confirmed' | 'Rejected';

export interface OutcomeDecision {
	outcome: ReferendumOutcome;
	approvalBps: number;
	participatingPoints: number;
	passed: boolean;
}

/**
 * Pure outcome calculation given thresholds and aggregate stats.
 * Does not check referendum status - the caller ensures the voting window has closed.
 * This is the single authoritative outcome algorithm.
 *
 * A referendum passes when it closes if:
 *   approval >= approvalThresholdBps  AND  participatingPoints >= minimumTurnoutPoints
 *
 * Frozen contract (PR-1): the final decision uses exact integer cross-multiplication
 * (`ayePoints * 10000 >= approvalThresholdBps * (ayePoints + nayPoints)` via BigInt),
 * never the rounded display `approvalBps`, so results slightly below the threshold
 * can never be rounded into a pass.
 */
export function computeFinalOutcome(approvalThresholdBps: number, minimumTurnoutPoints: number, stats: ReferendumStats): OutcomeDecision {
	const { ayePoints, nayPoints } = stats;
	const denominator = ayePoints + nayPoints;
	const participation = participatingPoints(stats);

	// Exact comparison via BigInt cross-multiplication (no floating point, no rounding).
	// Zero denominator => approval is literally 0, which only passes a 0 bps threshold.
	let passesApproval: boolean;
	if (denominator === 0) {
		passesApproval = approvalThresholdBps === 0;
	} else {
		passesApproval = BigInt(ayePoints) * BigInt(10000) >= BigInt(approvalThresholdBps) * BigInt(denominator);
	}
	const passesTurnout = participation >= minimumTurnoutPoints;
	const passes = passesApproval && passesTurnout;

	return {
		outcome: passes ? 'Confirmed' : 'Rejected',
		// Rounded bps is display-only and must never drive the decision.
		approvalBps: approvalBps(stats),
		participatingPoints: participation,
		passed: passes
	};
}

/**
 * Legacy wrapper that validates referendum status.
 */
export function decideOutcome(referendum: Pick<Referendum, 'approvalThresholdBps' | 'minimumTurnoutPoints' | 'status'>, stats: ReferendumStats): OutcomeDecision {
	if (referendum.status === ReferendumStatus.Submitted) {
		throw new Error('Cannot decide outcome for a Submitted referendum.');
	}
	return computeFinalOutcome(referendum.approvalThresholdBps, referendum.minimumTurnoutPoints, stats);
}
