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
 * All arithmetic is integer-basis-points based.
 */
export function computeFinalOutcome(approvalThresholdBps: number, minimumTurnoutPoints: number, stats: ReferendumStats): OutcomeDecision {
	const aBps = approvalBps(stats);
	const participation = participatingPoints(stats);

	const passesApproval = aBps >= approvalThresholdBps;
	const passesTurnout = participation >= minimumTurnoutPoints;

	// Zero denominator => approval is 0, can never exceed a non-zero threshold.
	const passes = approvalThresholdBps === 0 ? passesTurnout && passesApproval : passesApproval && passesTurnout;

	return {
		outcome: passes ? 'Confirmed' : 'Rejected',
		approvalBps: aBps,
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
