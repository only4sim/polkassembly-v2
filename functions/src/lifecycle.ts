// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Referenda lifecycle processor (plan PR-4 / Phase 3).
 *
 * Single authoritative lifecycle transition table, executed with one captured
 * `now` per run and re-validated inside every transaction:
 *
 *   Submitted  (votingStartsAt <= now < votingEndsAt) -> Deciding
 *   Submitted  (now >= votingEndsAt)                  -> Rejected
 *   Deciding   (now >= votingEndsAt)                  -> Confirmed | Rejected
 *   Submitted  (now < votingStartsAt)                 -> unchanged (skipped)
 *   Deciding   (now < votingEndsAt)                   -> unchanged (skipped)
 *   Cancelled / Confirmed / Rejected                  -> unchanged (idempotent)
 *
 * The outcome formula is aligned with the Next.js domain implementation
 * (`src/domain/services/referendumOutcome.ts`): exact BigInt cross-multiplication,
 * never the rounded display bps. A conformance test in
 * `tests/emulator/referendaLifecycle.test.ts` cross-checks both on the same
 * inputs, so the two copies cannot silently diverge.
 *
 * The scheduled wrapper (`finalizeReferenda.ts`) only supplies the db handle,
 * the captured time and logging; tests call `processReferendaLifecycle`
 * directly with an injected `now`.
 */

/* eslint-disable no-await-in-loop, no-restricted-syntax, no-use-before-define, prefer-destructuring, @typescript-eslint/no-explicit-any */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const APPROVAL_BPS_DENOM = 10000;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCHES = 20;

export interface LifecycleRunResult {
	scanned: number;
	opened: number;
	rejectedExpired: number;
	finalized: number;
	failed: number;
}

export interface LifecycleOptions {
	batchSize?: number;
	maxBatches?: number;
}

function parsePoints(v: unknown): number {
	if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return v;
	return 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMillis(v: any): number {
	if (!v) return 0;
	if (typeof v.toMillis === 'function') return v.toMillis();
	const parsed = Date.parse(v);
	return Number.isNaN(parsed) ? 0 : parsed;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statsFrom(data: any): { ayePoints: number; nayPoints: number; abstainPoints: number } {
	return {
		ayePoints: parsePoints(data?.ayePoints),
		nayPoints: parsePoints(data?.nayPoints),
		abstainPoints: parsePoints(data?.abstainPoints)
	};
}

/**
 * Exact threshold comparison — MUST stay identical to the Next.js domain implementation.
 *
 * @param {number} approvalThresholdBps - Minimum approval in basis points.
 * @param {number} minimumTurnoutPoints - Minimum participating points.
 * @param {object} stats - Aggregate point totals (ayePoints, nayPoints, abstainPoints).
 * @return {string} 'Confirmed' when approval and turnout both meet their thresholds.
 */
export function computeFinalOutcomeExact(
	approvalThresholdBps: number,
	minimumTurnoutPoints: number,
	stats: { ayePoints: number; nayPoints: number; abstainPoints: number }
): 'Confirmed' | 'Rejected' {
	const denominator = stats.ayePoints + stats.nayPoints;
	let passesApproval: boolean;
	if (denominator === 0) {
		passesApproval = approvalThresholdBps === 0;
	} else {
		passesApproval = BigInt(stats.ayePoints) * BigInt(APPROVAL_BPS_DENOM) >= BigInt(approvalThresholdBps) * BigInt(denominator);
	}
	const passesTurnout = stats.ayePoints + stats.nayPoints + stats.abstainPoints >= minimumTurnoutPoints;
	return passesApproval && passesTurnout ? 'Confirmed' : 'Rejected';
}

/**
 * Runs one full lifecycle pass. Idempotent: every transition re-reads the
 * document inside its transaction and re-checks the state and time window, so
 * repeated runs and concurrent schedulers converge without double effects.
 *
 * @param {object} db - Firestore handle (Admin SDK).
 * @param {Date} now - The captured server instant for this pass.
 * @param {object} options - Batch tuning (batchSize, maxBatches).
 * @return {Promise} Per-transition counters for observability.
 */
export async function processReferendaLifecycle(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	db: any,
	now: Date,
	options: LifecycleOptions = {}
): Promise<LifecycleRunResult> {
	const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
	const maxBatches = options.maxBatches ?? MAX_BATCHES;
	// Per-invocation counters: MUST be local so repeated invocations in the same
	// process (reused Cloud Function instance) report fresh metrics instead of
	// accumulating across calls.
	const result: LifecycleRunResult = { scanned: 0, opened: 0, rejectedExpired: 0, finalized: 0, failed: 0 };
	const nowMs = now.getTime();
	const nowTs = admin.firestore.Timestamp.fromDate(now);
	// ---- Phase A: Submitted -> Deciding | Rejected (expired) ----
	for (let batch = 0; batch < maxBatches; batch += 1) {
		const snap = await db.collection('referenda').where('status', '==', 'Submitted').where('votingStartsAt', '<=', nowTs).limit(batchSize).get();
		if (snap.empty) break;
		result.scanned += snap.size;

		for (const docSnap of snap.docs) {
			try {
				const outcome = await db.runTransaction(async (tx: any) => {
					const fresh = await tx.get(docSnap.ref);
					if (!fresh.exists) return 'skip';
					const data = fresh.data() ?? {};
					if (data.status !== 'Submitted') return 'skip';
					if (toMillis(data.votingStartsAt) > nowMs) return 'skip';
					if (toMillis(data.votingEndsAt) <= nowMs) {
						// Window expired while still Submitted: it can never be voted on.
						tx.update(docSnap.ref, { status: 'Rejected', closedAt: nowTs, updatedAt: nowTs });
						return 'rejected';
					}
					tx.update(docSnap.ref, { status: 'Deciding', updatedAt: nowTs });
					return 'opened';
				});
				if (outcome === 'opened') result.opened += 1;
				else if (outcome === 'rejected') result.rejectedExpired += 1;
			} catch (error) {
				result.failed += 1;
				logger.error('lifecycle: Submitted transition failed', { id: docSnap.id, phase: 'open', error: String(error) });
			}
		}
		if (snap.size < batchSize) break;
	}

	// ---- Phase B: Deciding -> Confirmed | Rejected ----
	for (let batch = 0; batch < maxBatches; batch += 1) {
		const snap = await db.collection('referenda').where('status', '==', 'Deciding').where('votingEndsAt', '<=', nowTs).limit(batchSize).get();
		if (snap.empty) break;
		result.scanned += snap.size;

		for (const docSnap of snap.docs) {
			try {
				const outcome = await db.runTransaction(async (tx: any) => {
					const ref = docSnap.ref;
					const statsRef = ref.collection('stats').doc('current');
					const [fresh, statsSnap] = await Promise.all([tx.get(ref), tx.get(statsRef)]);
					if (!fresh.exists) return 'skip';
					const data = fresh.data() ?? {};
					if (data.status !== 'Deciding') return 'skip';
					if (toMillis(data.votingEndsAt) > nowMs) return 'skip';
					const stats = statsFrom(statsSnap.data());
					const finalStatus = computeFinalOutcomeExact(parsePoints(data.approvalThresholdBps), parsePoints(data.minimumTurnoutPoints), stats);
					tx.update(ref, { status: finalStatus, closedAt: nowTs, updatedAt: nowTs });
					return finalStatus;
				});
				if (outcome === 'Confirmed' || outcome === 'Rejected') result.finalized += 1;
			} catch (error) {
				result.failed += 1;
				logger.error('lifecycle: Deciding finalization failed', { id: docSnap.id, phase: 'finalize', error: String(error) });
			}
		}
		if (snap.size < batchSize) break;
	}

	return result;
}
