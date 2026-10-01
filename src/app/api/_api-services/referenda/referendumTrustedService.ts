// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable max-classes-per-file, class-methods-use-this, no-param-reassign, lines-between-class-members, sonarjs/no-duplicate-string, default-case, sonarjs/prefer-immediate-return */

import { Timestamp } from 'firebase-admin/firestore';
import { ReferendumDecision, ReferendumStatus } from '@/domain/entities/Referendum';
import { type ReferendumComment } from '@/domain/entities/ReferendumComment';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';
import { type ReferendaActivityEvent, ACTIVITY_EVENT_SCHEMA_VERSION } from '@/domain/entities/ReferendaActivityEvent';
import { assertRemovalAllowed, validateVoteInput, validateCreationInput, VoteValidationError, CreationValidationError } from '@/domain/services/referendumValidation';
import { applyVoteDelta, emptyReferendumStats, subtractVote } from '@/domain/services/referendumStatsDelta';
import { computeFinalOutcome } from '@/domain/services/referendumOutcome';
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
				const now = new Date();
				const votingStartsAt = new Date(referendum.votingStartsAt);
				const votingEndsAt = new Date(referendum.votingEndsAt);

				// F17 fix: lazy activation — if the referendum is Submitted but the
				// voting window is currently open, atomically transition to Deciding
				// within this transaction. This prevents short windows from being
				// missed by the 5-minute scheduler.
				let effectiveStatus = referendum.status;
				if (referendum.status === ReferendumStatus.Submitted && now >= votingStartsAt && now < votingEndsAt) {
					effectiveStatus = ReferendumStatus.Deciding;
					tx.set(ref, {
						...refSnap.data(),
						status: ReferendumStatus.Deciding,
						updatedAt: Timestamp.now()
					});
				}

				validateVoteInput({
					uid: actor.uid,
					decision: payload.decision,
					pointsUsed: payload.pointsUsed,
					pointsBalance,
					referendumStatus: effectiveStatus,
					now,
					votingStartsAt,
					votingEndsAt
				});
				const prev = voteSnap.exists ? mapVote(voteSnap.data()!, actor.uid) : null;
				const stats = statsSnap.exists ? mapStats(statsSnap.data()!) : emptyReferendumStats();
				const nowTs = Timestamp.now();
				const nextStats = applyVoteDelta(stats, prev, payload);
				tx.set(voteRef, {
					uid: actor.uid,
					voterDisplayName: displayName,
					decision: payload.decision,
					pointsUsed: payload.pointsUsed,
					balanceAtVote: pointsBalance,
					createdAt: prev ? prev.createdAt : nowTs,
					updatedAt: nowTs,
					schemaVersion: VOTE_SCHEMA_VERSION,
					// F10 fix: discriminator so collectionGroup('votes') queries can
					// distinguish referendum votes from discussion poll votes.
					type: 'referendum'
				});
				tx.set(statsRef, {
					ayePoints: nextStats.ayePoints,
					nayPoints: nextStats.nayPoints,
					abstainPoints: nextStats.abstainPoints,
					ayeVoters: nextStats.ayeVoters,
					nayVoters: nextStats.nayVoters,
					abstainVoters: nextStats.abstainVoters,
					totalVoters: nextStats.totalVoters,
					updatedAt: nowTs,
					schemaVersion: STATS_SCHEMA_VERSION
				});
				// F16/P7: write activity event transactionally
				const eventType = prev ? 'vote_changed' : 'vote_cast';
				this.db.collection('referendaActivityEvents').add({
					index,
					type: eventType,
					occurredAt: nowTs,
					actorDisplayName: displayName,
					summary: `${displayName} ${prev ? 'changed' : 'cast'} a ${payload.decision} vote with ${payload.pointsUsed} points`,
					schemaVersion: ACTIVITY_EVENT_SCHEMA_VERSION
				});
				return {
					vote: {
						uid: actor.uid,
						voterDisplayName: displayName,
						decision: payload.decision,
						pointsUsed: payload.pointsUsed,
						balanceAtVote: pointsBalance,
						createdAt: prev ? prev.createdAt : nowTs.toDate().toISOString(),
						updatedAt: nowTs.toDate().toISOString(),
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
				// F16/P7: activity event for vote removal
				this.db.collection('referendaActivityEvents').add({
					index,
					type: 'vote_removed',
					occurredAt: now,
					summary: `Vote removed for referendum #${index}`,
					schemaVersion: ACTIVITY_EVENT_SCHEMA_VERSION
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
			const created = await this.repo.create({
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
			// F16/P7: activity event for creation
			await this.db.collection('referendaActivityEvents').add({
				index: created.index,
				type: 'created',
				occurredAt: Timestamp.now(),
				actorDisplayName: authorDisplayName,
				summary: `Referendum #${created.index} created: ${validated.title}`,
				schemaVersion: ACTIVITY_EVENT_SCHEMA_VERSION
			});
			return created;
		} catch (err) {
			throw toServiceError(err);
		}
	}

	/**
	 * Admin finalization (plan P2 / ops): finalizes an EXPIRED Deciding
	 * referendum immediately using the shared exact outcome algorithm — same
	 * contract as the scheduled lifecycle processor. Useful for local dev
	 * (no scheduler) and manual operations; production keeps the automatic
	 * schedule. Admin-only, transactional, idempotent-in-effect.
	 */
	async adminFinalize(index: number, isAdmin: boolean): Promise<{ status: string; outcome: string }> {
		try {
			if (!isAdmin) throw new ReferendaServiceError('forbidden', 'Only administrators can finalize.');
			const nowMs = Date.now();
			return this.db.runTransaction(async (tx) => {
				const ref = referendumDoc(this.db, index);
				const statsRef = statsDoc(this.db, index);
				const [snap, statsSnap] = await Promise.all([tx.get(ref), tx.get(statsRef)]);
				if (!snap.exists) throw new ReferendaServiceError('not-found', 'Referendum not found.');
				const existing = mapReferendum(snap.data()!, index);
				if (existing.status === ReferendumStatus.Confirmed || existing.status === ReferendumStatus.Rejected || existing.status === ReferendumStatus.Cancelled) {
					throw new ReferendaServiceError('conflict', 'Referendum is already closed.');
				}
				if (existing.status !== ReferendumStatus.Deciding || nowMs < new Date(existing.votingEndsAt).getTime()) {
					throw new ReferendaServiceError('conflict', 'Finalization is only allowed after the voting window has ended.');
				}
				const stats = statsSnap.exists ? mapStats(statsSnap.data()!) : emptyReferendumStats();
				const outcome = computeFinalOutcome(existing.approvalThresholdBps, existing.minimumTurnoutPoints, stats);
				const now = Timestamp.now();
				tx.update(ref, { status: outcome.outcome, closedAt: now, updatedAt: now });
				// F16/P7: activity event for finalization
				this.db.collection('referendaActivityEvents').add({
					index,
					type: outcome.outcome === ReferendumStatus.Confirmed ? 'confirmed' : 'rejected',
					occurredAt: now,
					summary: `Referendum #${index} ${outcome.outcome.toLowerCase()}`,
					schemaVersion: ACTIVITY_EVENT_SCHEMA_VERSION
				});
				return { status: outcome.outcome, outcome: outcome.outcome };
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
				// F16/P7: activity event for cancellation
				this.db.collection('referendaActivityEvents').add({
					index,
					type: 'cancelled',
					occurredAt: Timestamp.now(),
					summary: `Referendum #${index} cancelled`,
					schemaVersion: ACTIVITY_EVENT_SCHEMA_VERSION
				});
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
			// P7: discussion lock check — locked referenda reject new comments
			if (referendumSnap.data()?.discussionLocked === true) {
				throw new ReferendaServiceError('forbidden', 'Discussion is locked.');
			}

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

	/**
	 * F16/P7: Toggle discussion lock (admin-only). Locking prevents new comments
	 * but does not affect voting, status, or thresholds. Unlocking restores
	 * comment writing. Records an activity event for the feed.
	 */
	async setDiscussionLock(index: number, locked: boolean, actor: VerifiedActor, isAdmin: boolean): Promise<void> {
		try {
			if (!isAdmin) throw new ReferendaServiceError('forbidden', 'Only administrators can lock discussions.');
			await this.db.runTransaction(async (tx) => {
				const ref = referendumDoc(this.db, index);
				const snap = await tx.get(ref);
				if (!snap.exists) throw new ReferendaServiceError('not-found', 'Referendum not found.');
				const now = Timestamp.now();
				tx.update(ref, { discussionLocked: locked, updatedAt: now });
				const eventsRef = this.db.collection('referendaActivityEvents');
				eventsRef.add({
					index,
					type: locked ? 'discussion_locked' : 'discussion_unlocked',
					occurredAt: now,
					actorDisplayName: actor.displayName,
					summary: locked ? 'Discussion locked by admin' : 'Discussion unlocked by admin',
					schemaVersion: ACTIVITY_EVENT_SCHEMA_VERSION
				});
			});
		} catch (err) {
			throw toServiceError(err);
		}
	}

	/**
	 * F16/P7: List recent activity events for the public feed.
	 * Ordered by occurredAt descending (most recent first).
	 */
	async listActivityEvents(options: { limit?: number; page?: number } = {}): Promise<{ items: ReferendaActivityEvent[]; totalCount: number }> {
		const limit = Math.max(1, Math.floor(options.limit ?? 20));
		const page = Math.max(1, Math.floor(options.page ?? 1));
		const ref = this.db.collection('referendaActivityEvents');
		const [snapshot, countSnap] = await Promise.all([
			ref
				.orderBy('occurredAt', 'desc')
				.limit(limit)
				.offset((page - 1) * limit)
				.get(),
			ref.count().get()
		]);
		const items = snapshot.docs.map((d) => {
			const data = d.data();
			return {
				id: d.id,
				index: data.index as number,
				type: data.type as ReferendaActivityEvent['type'],
				occurredAt: (data.occurredAt as Timestamp).toDate().toISOString(),
				actorDisplayName: data.actorDisplayName as string | undefined,
				summary: data.summary as string | undefined,
				schemaVersion: data.schemaVersion as number
			};
		});
		return { items, totalCount: countSnap.data().count };
	}
}
