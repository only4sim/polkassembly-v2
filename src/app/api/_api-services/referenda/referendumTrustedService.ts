// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable max-classes-per-file, class-methods-use-this, no-param-reassign, lines-between-class-members, sonarjs/no-duplicate-string, default-case, sonarjs/prefer-immediate-return */

import { Timestamp } from 'firebase-admin/firestore';
import { ReferendumDecision, ReferendumStatus } from '@/domain/entities/Referendum';
import { type ReferendumComment } from '@/domain/entities/ReferendumComment';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';
import { assertRemovalAllowed, validateVoteInput, validateCreationInput, VoteValidationError, CreationValidationError } from '@/domain/services/referendumValidation';
import { applyVoteDelta, emptyReferendumStats, subtractVote } from '@/domain/services/referendumStatsDelta';
import { COMMENT_MAX_LENGTH, COMMENT_SCHEMA_VERSION, REFERENDUM_SCHEMA_VERSION, STATS_SCHEMA_VERSION, VOTE_SCHEMA_VERSION } from '@/domain/fixtures/referendaFixtures';
import { getAdminDb } from '@/adapters/firestore/firestoreInit';
import { FirestoreReferendumRepository } from '@/adapters/firestore/FirestoreReferendumRepository';
import { commentDoc, commentsRef, mapReferendum, mapStats, mapVote, referendumDoc, statsDoc, voteDoc } from '@/adapters/firestore/referendaMappers';

export interface VotePayload {
	decision: ReferendumDecision;
	pointsUsed: number;
}
export interface VerifiedActor {
	uid: string;
	displayName: string;
}

export interface CreateReferendumInput {
	title: string;
	content: string;
	origin: string;
	tags?: string[];
	votingStartsAt: string;
	votingEndsAt: string;
	approvalThresholdBps: number;
	minimumTurnoutPoints: number;
}

export type ReferendaServiceErrorCode =
	| 'unauthorized'
	| 'not-found'
	| 'not-deciding'
	| 'outside-voting-window'
	| 'invalid-argument'
	| 'insufficient-balance'
	| 'conflict'
	| 'forbidden';

export class ReferendaServiceError extends Error {
	code: ReferendaServiceErrorCode;
	constructor(code: ReferendaServiceErrorCode, message: string) {
		super(message);
		this.name = 'ReferendaServiceError';
		this.code = code;
	}
}

function toServiceError(err: unknown): unknown {
	if (err instanceof ReferendaServiceError) return err;
	if (err instanceof VoteValidationError) {
		const map: Record<string, ReferendaServiceErrorCode> = {
			'not-logged-in': 'unauthorized',
			'referendum-not-found': 'not-found',
			'not-deciding': 'not-deciding',
			'outside-voting-window': 'outside-voting-window',
			'invalid-decision': 'invalid-argument',
			'invalid-amount': 'invalid-argument',
			'insufficient-balance': 'insufficient-balance'
		};
		return new ReferendaServiceError(map[err.code] ?? 'invalid-argument', err.message);
	}
	if (err instanceof CreationValidationError) {
		return new ReferendaServiceError(err.code === 'unauthorized' ? 'unauthorized' : 'invalid-argument', err.message);
	}
	// Frozen contract (PR-1): only known business errors are mapped to HTTP 4xx.
	// Unknown errors (infra failures, corrupt state, Firestore contention) are
	// re-thrown untouched so the API boundary returns 500 instead of 409.
	return err;
}

export class ReferendumTrustedService {
	private db = getAdminDb();
	private repo = new FirestoreReferendumRepository();

	async upsertVote(index: number, actor: VerifiedActor, payload: VotePayload): Promise<{ vote: ReferendumVote; stats: ReferendumStats }> {
		try {
			return await this.db.runTransaction(async (tx) => {
				const ref = referendumDoc(this.db, index);
				const voteRef = voteDoc(this.db, index, actor.uid);
				const userRef = this.db.collection('users').doc(actor.uid);
				const statsRef = statsDoc(this.db, index);
				const [refSnap, voteSnap, userSnap, statsSnap] = await Promise.all([tx.get(ref), tx.get(voteRef), tx.get(userRef), tx.get(statsRef)]);
				if (!refSnap.exists) throw new ReferendaServiceError('not-found', 'Referendum not found.');
				const referendum = mapReferendum(refSnap.data()!, index);
				// Frozen contract (PR-3): the Firestore user profile is mandatory and is
				// the authoritative source of the balance and display name.
				if (!userSnap.exists) throw new ReferendaServiceError('not-found', 'User profile not found.');
				const pointsBalance = userSnap.data()?.pointsBalance as number | undefined;
				if (typeof pointsBalance !== 'number' || !Number.isSafeInteger(pointsBalance) || pointsBalance < 0) {
					throw new ReferendaServiceError('conflict', 'User profile has an invalid points balance.');
				}
				const displayName = (userSnap.data()?.displayName as string) || '';
				validateVoteInput({
					uid: actor.uid,
					decision: payload.decision,
					pointsUsed: payload.pointsUsed,
					pointsBalance,
					referendumStatus: referendum.status,
					now: new Date(),
					votingStartsAt: new Date(referendum.votingStartsAt),
					votingEndsAt: new Date(referendum.votingEndsAt)
				});
				const prev = voteSnap.exists ? mapVote(voteSnap.data()!, actor.uid) : null;
				const stats = statsSnap.exists ? mapStats(statsSnap.data()!) : emptyReferendumStats();
				const now = Timestamp.now();
				const nextStats = applyVoteDelta(stats, prev, payload);
				tx.set(voteRef, {
					uid: actor.uid,
					voterDisplayName: displayName,
					decision: payload.decision,
					pointsUsed: payload.pointsUsed,
					balanceAtVote: pointsBalance,
					createdAt: prev ? prev.createdAt : now,
					updatedAt: now,
					schemaVersion: VOTE_SCHEMA_VERSION
				});
				tx.set(statsRef, {
					ayePoints: nextStats.ayePoints,
					nayPoints: nextStats.nayPoints,
					abstainPoints: nextStats.abstainPoints,
					ayeVoters: nextStats.ayeVoters,
					nayVoters: nextStats.nayVoters,
					abstainVoters: nextStats.abstainVoters,
					totalVoters: nextStats.totalVoters,
					updatedAt: now,
					schemaVersion: STATS_SCHEMA_VERSION
				});
				return {
					vote: {
						uid: actor.uid,
						voterDisplayName: displayName,
						decision: payload.decision,
						pointsUsed: payload.pointsUsed,
						balanceAtVote: pointsBalance,
						createdAt: prev ? prev.createdAt : now.toDate().toISOString(),
						updatedAt: now.toDate().toISOString(),
						schemaVersion: VOTE_SCHEMA_VERSION
					},
					stats: nextStats
				};
			});
		} catch (err) {
			throw toServiceError(err);
		}
	}

	async removeVote(index: number, actor: VerifiedActor): Promise<ReferendumStats> {
		try {
			return await this.db.runTransaction(async (tx) => {
				const ref = referendumDoc(this.db, index);
				const voteRef = voteDoc(this.db, index, actor.uid);
				const statsRef = statsDoc(this.db, index);
				const [refSnap, voteSnap, statsSnap] = await Promise.all([tx.get(ref), tx.get(voteRef), tx.get(statsRef)]);
				if (!refSnap.exists) throw new ReferendaServiceError('not-found', 'Referendum not found.');
				const referendum = mapReferendum(refSnap.data()!, index);
				// Frozen contract (PR-1): idempotent removal returns the current stats.
				if (!voteSnap.exists) return statsSnap.exists ? mapStats(statsSnap.data()!) : emptyReferendumStats();
				assertRemovalAllowed(referendum.status, new Date(), new Date(referendum.votingStartsAt), new Date(referendum.votingEndsAt));
				const prev = mapVote(voteSnap.data()!, actor.uid);
				const stats = statsSnap.exists ? mapStats(statsSnap.data()!) : emptyReferendumStats();
				const now = Timestamp.now();
				const nextStats = subtractVote(stats, prev);
				tx.delete(voteRef);
				tx.set(statsRef, {
					ayePoints: nextStats.ayePoints,
					nayPoints: nextStats.nayPoints,
					abstainPoints: nextStats.abstainPoints,
					ayeVoters: nextStats.ayeVoters,
					nayVoters: nextStats.nayVoters,
					abstainVoters: nextStats.abstainVoters,
					totalVoters: nextStats.totalVoters,
					updatedAt: now,
					schemaVersion: STATS_SCHEMA_VERSION
				});
				return nextStats;
			});
		} catch (err) {
			throw toServiceError(err);
		}
	}

	async createReferendum(actor: VerifiedActor, input: CreateReferendumInput) {
		try {
			const validated = validateCreationInput({ uid: actor.uid, ...input });
			// Frozen contract (PR-3): the author display name comes from the Firestore
			// profile (authoritative), which must exist.
			const userSnap = await this.db.collection('users').doc(actor.uid).get();
			if (!userSnap.exists) {
				throw new ReferendaServiceError('not-found', 'User profile not found.');
			}
			const authorDisplayName = (userSnap.data()?.displayName as string) || actor.displayName;
			// Frozen contract (PR-4): the initial status is decided inside the creation
			// transaction from one captured server `now` — no second transition call:
			//   now <  startsAt -> Submitted
			//   now >= startsAt -> Deciding (the window is open)
			//   now >= endsAt   -> rejected (already expired, 400)
			const nowMs = Date.now();
			if (nowMs >= validated.votingEndsAt.getTime()) {
				throw new ReferendaServiceError('invalid-argument', 'The voting window has already expired.');
			}
			const initialStatus = nowMs >= validated.votingStartsAt.getTime() ? ReferendumStatus.Deciding : ReferendumStatus.Submitted;
			return this.repo.create({
				title: validated.title,
				content: validated.content,
				authorUid: actor.uid,
				authorDisplayName,
				origin: validated.origin,
				status: initialStatus,
				tags: validated.tags,
				votingStartsAt: validated.votingStartsAt.toISOString(),
				votingEndsAt: validated.votingEndsAt.toISOString(),
				approvalThresholdBps: validated.approvalThresholdBps,
				minimumTurnoutPoints: validated.minimumTurnoutPoints,
				schemaVersion: REFERENDUM_SCHEMA_VERSION
			});
		} catch (err) {
			throw toServiceError(err);
		}
	}

	async cancelReferendum(index: number, actorUid: string, isAdmin: boolean): Promise<void> {
		try {
			if (!actorUid) throw new ReferendaServiceError('unauthorized', 'You must be logged in.');
			if (!isAdmin) throw new ReferendaServiceError('forbidden', 'Only administrators can cancel.');
			await this.db.runTransaction(async (tx) => {
				const ref = referendumDoc(this.db, index);
				const snap = await tx.get(ref);
				if (!snap.exists) throw new ReferendaServiceError('not-found', 'Referendum not found.');
				const existing = mapReferendum(snap.data()!, index);
				if (existing.status === ReferendumStatus.Cancelled || existing.status === ReferendumStatus.Confirmed || existing.status === ReferendumStatus.Rejected) {
					throw new ReferendaServiceError('conflict', 'Referendum is already closed.');
				}
				tx.update(ref, { status: ReferendumStatus.Cancelled, closedAt: Timestamp.now(), updatedAt: Timestamp.now() });
			});
		} catch (err) {
			throw toServiceError(err);
		}
	}

	/**
	 * Add a comment to a referendum (plan PR-7). Identity comes from the
	 * verified token; display name from the authoritative Firestore profile.
	 * Single trusted write — no client-side comment writes exist.
	 */
	async addComment(index: number, actor: VerifiedActor, content: string): Promise<ReferendumComment> {
		try {
			if (!actor.uid) throw new ReferendaServiceError('unauthorized', 'You must be logged in.');
			const trimmed = typeof content === 'string' ? content.trim() : '';
			if (!trimmed) throw new ReferendaServiceError('invalid-argument', 'Comment cannot be empty.');
			if (trimmed.length > COMMENT_MAX_LENGTH) {
				throw new ReferendaServiceError('invalid-argument', `Comment cannot exceed ${COMMENT_MAX_LENGTH} characters.`);
			}
			const profileSnap = await this.db.collection('users').doc(actor.uid).get();
			if (!profileSnap.exists) throw new ReferendaServiceError('not-found', 'User profile not found.');
			const displayName = (profileSnap.data()?.displayName as string | undefined) || actor.displayName;

			const referendumSnap = await referendumDoc(this.db, index).get();
			if (!referendumSnap.exists) throw new ReferendaServiceError('not-found', 'Referendum not found.');

			const now = Timestamp.now();
			const ref = await commentsRef(this.db, index).add({
				index,
				authorUid: actor.uid,
				authorDisplayName: displayName,
				content: trimmed,
				createdAt: now,
				updatedAt: now,
				schemaVersion: COMMENT_SCHEMA_VERSION
			});
			return {
				id: ref.id,
				index,
				authorUid: actor.uid,
				authorDisplayName: displayName,
				content: trimmed,
				createdAt: now.toDate().toISOString(),
				updatedAt: now.toDate().toISOString(),
				schemaVersion: COMMENT_SCHEMA_VERSION
			};
		} catch (err) {
			throw toServiceError(err);
		}
	}

	/**
	 * Delete a comment: the author or an administrator. Missing comments are
	 * idempotently successful; deleting someone else's comment is 403.
	 */
	async deleteComment(index: number, commentId: string, actorUid: string, isAdmin: boolean): Promise<void> {
		try {
			if (!actorUid) throw new ReferendaServiceError('unauthorized', 'You must be logged in.');
			await this.db.runTransaction(async (tx) => {
				const ref = commentDoc(this.db, index, commentId);
				const snap = await tx.get(ref);
				if (!snap.exists) return; // idempotent delete
				const data = snap.data() ?? {};
				if (!isAdmin && data.authorUid !== actorUid) {
					throw new ReferendaServiceError('forbidden', 'You can only delete your own comments.');
				}
				tx.delete(ref);
			});
		} catch (err) {
			throw toServiceError(err);
		}
	}
}
