// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable max-classes-per-file, class-methods-use-this, no-param-reassign, lines-between-class-members, sonarjs/no-duplicate-string, default-case, sonarjs/prefer-immediate-return */

import { Timestamp } from 'firebase-admin/firestore';
import { ReferendumDecision, ReferendumStatus } from '@/domain/entities/Referendum';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';
import { assertRemovalAllowed, validateVoteInput, validateCreationInput, VoteValidationError, CreationValidationError } from '@/domain/services/referendumValidation';
import { REFERENDUM_SCHEMA_VERSION, STATS_SCHEMA_VERSION, VOTE_SCHEMA_VERSION } from '@/domain/fixtures/referendaFixtures';
import { getAdminDb } from '@/adapters/firestore/firestoreInit';
import { FirestoreReferendumRepository } from '@/adapters/firestore/FirestoreReferendumRepository';
import { mapReferendum, mapStats, mapVote, referendumDoc, statsDoc, voteDoc } from '@/adapters/firestore/referendaMappers';

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

function toServiceError(err: unknown): ReferendaServiceError {
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
	return new ReferendaServiceError('conflict', (err as Error).message || 'Referenda operation failed.');
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
				const pointsBalance = (userSnap.data()?.pointsBalance as number) ?? 0;
				const displayName = (userSnap.data()?.displayName as string) || actor.displayName;
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
				const stats = statsSnap.exists ? mapStats(statsSnap.data()!) : this.emptyStats();
				const now = Timestamp.now();
				const nextStats = this.applyDelta(stats, prev, payload, now);
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

	async removeVote(index: number, actor: VerifiedActor): Promise<void> {
		try {
			await this.db.runTransaction(async (tx) => {
				const ref = referendumDoc(this.db, index);
				const voteRef = voteDoc(this.db, index, actor.uid);
				const statsRef = statsDoc(this.db, index);
				const [refSnap, voteSnap, statsSnap] = await Promise.all([tx.get(ref), tx.get(voteRef), tx.get(statsRef)]);
				if (!refSnap.exists) throw new ReferendaServiceError('not-found', 'Referendum not found.');
				const referendum = mapReferendum(refSnap.data()!, index);
				if (!voteSnap.exists) return;
				assertRemovalAllowed(referendum.status, new Date(), new Date(referendum.votingStartsAt), new Date(referendum.votingEndsAt));
				const prev = mapVote(voteSnap.data()!, actor.uid);
				const stats = statsSnap.exists ? mapStats(statsSnap.data()!) : this.emptyStats();
				const now = Timestamp.now();
				const nextStats = this.subtractContribution(stats, prev, now);
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
			});
		} catch (err) {
			throw toServiceError(err);
		}
	}

	async createReferendum(actor: VerifiedActor, input: CreateReferendumInput) {
		try {
			const validated = validateCreationInput({ uid: actor.uid, ...input });
			return this.repo.create({
				title: validated.title,
				content: validated.content,
				authorUid: actor.uid,
				authorDisplayName: actor.displayName,
				origin: validated.origin,
				status: ReferendumStatus.Submitted,
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

	async openForVoting(index: number): Promise<void> {
		try {
			await this.db.runTransaction(async (tx) => {
				const ref = referendumDoc(this.db, index);
				const snap = await tx.get(ref);
				if (!snap.exists) throw new ReferendaServiceError('not-found', 'Referendum not found.');
				tx.update(ref, { status: ReferendumStatus.Deciding, updatedAt: Timestamp.now() });
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

	private emptyStats(): ReferendumStats {
		return {
			ayePoints: 0,
			nayPoints: 0,
			abstainPoints: 0,
			ayeVoters: 0,
			nayVoters: 0,
			abstainVoters: 0,
			totalVoters: 0,
			updatedAt: new Date(0).toISOString(),
			schemaVersion: STATS_SCHEMA_VERSION
		};
	}

	private applyDelta(stats: ReferendumStats, prev: ReferendumVote | null, next: VotePayload, now: Timestamp): ReferendumStats {
		const result = { ...stats };
		if (prev) this.subtractFrom(result, prev.decision, prev.pointsUsed);
		this.addTo(result, next.decision, next.pointsUsed);
		result.updatedAt = now.toDate().toISOString();
		return result;
	}

	private subtractContribution(stats: ReferendumStats, prev: ReferendumVote, now: Timestamp): ReferendumStats {
		const result = { ...stats };
		this.subtractFrom(result, prev.decision, prev.pointsUsed);
		result.updatedAt = now.toDate().toISOString();
		return result;
	}

	private addTo(stats: ReferendumStats, decision: ReferendumDecision, points: number): void {
		stats.totalVoters += 1;
		if (decision === ReferendumDecision.AYE) {
			stats.ayePoints += points;
			stats.ayeVoters += 1;
		} else if (decision === ReferendumDecision.NAY) {
			stats.nayPoints += points;
			stats.nayVoters += 1;
		} else {
			stats.abstainPoints += points;
			stats.abstainVoters += 1;
		}
	}

	private subtractFrom(stats: ReferendumStats, decision: ReferendumDecision, points: number): void {
		if (stats.totalVoters < 1) throw new Error('corrupt stats: totalVoters would go negative');
		if (decision === ReferendumDecision.AYE) {
			if (stats.ayePoints < points || stats.ayeVoters < 1) throw new Error('corrupt stats: aye would go negative');
			stats.ayePoints -= points;
			stats.ayeVoters -= 1;
		} else if (decision === ReferendumDecision.NAY) {
			if (stats.nayPoints < points || stats.nayVoters < 1) throw new Error('corrupt stats: nay would go negative');
			stats.nayPoints -= points;
			stats.nayVoters -= 1;
		} else {
			if (stats.abstainPoints < points || stats.abstainVoters < 1) throw new Error('corrupt stats: abstain would go negative');
			stats.abstainPoints -= points;
			stats.abstainVoters -= 1;
		}
		stats.totalVoters -= 1;
	}
}
