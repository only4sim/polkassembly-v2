// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * finalizeReferenda - scheduled Cloud Function that is the single authoritative
 * lifecycle processor for points-based referenda.
 *
 * Responsibilities:
 * 1. Opens eligible Submitted referenda (votingStartsAt <= now) -> Deciding
 * 2. Finalizes expired Deciding referenda (votingEndsAt <= now) -> Confirmed/Rejected
 *
 * Both transitions are idempotent and run inside Firestore transactions.
 */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const APPROVAL_BPS_DENOM = 10000;

function parsePoints(v: unknown): number {
	if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
	return 0;
}

function iso(v: admin.firestore.Timestamp | string | undefined): string {
	if (!v) return new Date(0).toISOString();
	if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
	if (typeof v === 'string') return v;
	return new Date(0).toISOString();
}

function computeFinalOutcome(
	approvalThresholdBps: number,
	minimumTurnoutPoints: number,
	stats: { ayePoints?: number; nayPoints?: number; abstainPoints?: number }
): 'Confirmed' | 'Rejected' {
	// Frozen contract (PR-1): identical exact cross-multiplication as the Next.js
	// domain implementation — `ayePoints * 10000 >= threshold * (aye + nay)` via
	// BigInt. Rounded display bps must never drive the decision.
	const ayePoints = parsePoints(stats.ayePoints);
	const nayPoints = parsePoints(stats.nayPoints);
	const denominator = ayePoints + nayPoints;
	const participation = ayePoints + nayPoints + parsePoints(stats.abstainPoints);

	let passesApproval: boolean;
	if (denominator === 0) {
		passesApproval = approvalThresholdBps === 0;
	} else {
		passesApproval = BigInt(ayePoints) * BigInt(APPROVAL_BPS_DENOM) >= BigInt(approvalThresholdBps) * BigInt(denominator);
	}
	const passesTurnout = participation >= minimumTurnoutPoints;
	const passes = passesApproval && passesTurnout;
	return passes ? 'Confirmed' : 'Rejected';
}

export const finalizeReferenda = onSchedule(
	{
		schedule: 'every 5 minutes',
		timeZone: 'UTC',
		retryCount: 3,
		timeoutSeconds: 300
	},
	async () => {
		const db = admin.firestore();

		try {
			const now = new Date();
			let opened = 0;
			let finalized = 0;

			// 1. Open eligible Submitted referenda (votingStartsAt <= now)
			const toOpen = await db.collection('referenda').where('status', '==', 'Submitted').where('votingStartsAt', '<=', admin.firestore.Timestamp.fromDate(now)).limit(100).get();

			const openResults = await Promise.all(
				toOpen.docs.map((doc) =>
					db.runTransaction(async (tx) => {
						const ref = db.collection('referenda').doc(doc.id);
						const snap = await tx.get(ref);
						if (!snap.exists) return false;
						const data = snap.data()!;
						if (data.status !== 'Submitted') return false;
						// Only open if the window hasn't already expired
						const endsAt = data.votingEndsAt instanceof admin.firestore.Timestamp ? data.votingEndsAt.toDate() : new Date(iso(data.votingEndsAt));
						if (endsAt.getTime() <= now.getTime()) {
							// Voting window already expired; skip directly to rejected
							tx.update(ref, { status: 'Rejected', closedAt: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.Timestamp.now() });
							return true;
						}
						// Re-check the start boundary inside the transaction
						const startsAt = data.votingStartsAt instanceof admin.firestore.Timestamp ? data.votingStartsAt.toDate() : new Date(iso(data.votingStartsAt));
						if (startsAt.getTime() > now.getTime()) return false;
						tx.update(ref, { status: 'Deciding', updatedAt: admin.firestore.Timestamp.now() });
						return true;
					})
				)
			);
			opened = openResults.filter(Boolean).length;

			// 2. Finalize expired Deciding referenda
			const toFinalize = await db.collection('referenda').where('status', '==', 'Deciding').where('votingEndsAt', '<=', admin.firestore.Timestamp.fromDate(now)).limit(100).get();

			const finalizeResults = await Promise.all(
				toFinalize.docs.map((doc) =>
					db.runTransaction(async (tx) => {
						const ref = db.collection('referenda').doc(doc.id);
						const statsRef = ref.collection('stats').doc('current');

						const [refSnap, statsSnap] = await Promise.all([tx.get(ref), tx.get(statsRef)]);
						if (!refSnap.exists) return false;
						const data = refSnap.data()!;
						if (data.status !== 'Deciding') return false;

						const endsAt = data.votingEndsAt instanceof admin.firestore.Timestamp ? data.votingEndsAt.toDate() : new Date(iso(data.votingEndsAt));
						if (endsAt.getTime() > now.getTime()) return false;

						const stats = statsSnap.exists ? statsSnap.data()! : {};
						const outcome = computeFinalOutcome((data.approvalThresholdBps as number) ?? 0, (data.minimumTurnoutPoints as number) ?? 0, stats);

						tx.update(ref, {
							status: outcome,
							closedAt: admin.firestore.Timestamp.now(),
							updatedAt: admin.firestore.Timestamp.now()
						});
						return true;
					})
				)
			);
			finalized = finalizeResults.filter(Boolean).length;

			if (opened > 0 || finalized > 0) {
				logger.info(`finalizeReferenda: opened ${opened}, finalized ${finalized}`);
			}
		} catch (error) {
			logger.error('finalizeReferenda error:', error);
			// Re-throw so the scheduler can retry
			throw error;
		}
	}
);
