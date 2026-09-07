// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { ReferendumDecision } from './Referendum';

/**
 * An individual points-based vote cast by a user on a referendum.
 *
 * Stored in Firestore at `referenda/{index}/votes/{uid}`.
 *
 * Contract notes:
 * - One effective vote per Firebase UID per referendum.
 * - `pointsUsed` is the vote weight and is snapshotted at write time.
 * - `balanceAtVote` records the user's pointsBalance at write time for audit.
 * - Casting a vote does NOT deduct or transfer points.
 */
export interface ReferendumVote {
	/** Firebase Auth UID of the voter. */
	uid: string;
	voterDisplayName: string;
	decision: ReferendumDecision;
	/** Integer point weight (1..pointsBalance at the time of writing). */
	pointsUsed: number;
	/** pointsBalance snapshot at the time the vote was written. */
	balanceAtVote: number;
	createdAt: string;
	updatedAt: string;
	/** Schema version for forward/backward compatibility. */
	schemaVersion: number;
}
