// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { type Referendum } from '@/domain/entities/Referendum';
import { type ReferendumComment } from '@/domain/entities/ReferendumComment';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';
import { getAdminDb } from '@/adapters/firestore/firestoreInit';
import { FirestoreReferendumRepository } from '@/adapters/firestore/FirestoreReferendumRepository';
import { REFERENDA_COLLECTION, commentsRef, mapComment, mapReferendum, mapStats, mapVote, referendumDoc, statsDoc, voteDoc } from '@/adapters/firestore/referendaMappers';

export interface ReferendaListQuery {
	page: number;
	pageSize: number;
	statuses?: string[];
	origin?: string;
}

export interface ReferendaListResult {
	items: Referendum[];
	totalCount: number;
}

/**
 * Read-only server-side access for the points-based Referenda API family.
 */
export class ReferendumReadService {
	private db = getAdminDb();

	private repo = new FirestoreReferendumRepository();

	async getByIndex(index: number): Promise<Referendum | null> {
		return this.repo.getByIndex(index);
	}

	async list(query: ReferendaListQuery): Promise<ReferendaListResult> {
		return this.repo.list({
			page: query.page,
			pageSize: query.pageSize,
			statuses: query.statuses,
			origin: query.origin
		});
	}

	async getStats(index: number): Promise<ReferendumStats | null> {
		const doc = await statsDoc(this.db, index).get();
		if (!doc.exists) return null;
		return mapStats(doc.data()!);
	}

	async getVote(index: number, uid: string): Promise<ReferendumVote | null> {
		const doc = await voteDoc(this.db, index, uid).get();
		if (!doc.exists) return null;
		return mapVote(doc.data()!, uid);
	}

	/**
	 * Public vote history with offset pagination and an optional decision
	 * filter (plan PR-7). `decision` must be aye/nay/abstain when provided.
	 */
	async listVotes(index: number, options: { limit?: number; page?: number; decision?: 'aye' | 'nay' | 'abstain' } = {}): Promise<ReferendumVote[]> {
		const limit = Math.max(1, Math.floor(options.limit ?? 20));
		const page = Math.max(1, Math.floor(options.page ?? 1));
		let query = referendumDoc(this.db, index).collection('votes').orderBy('updatedAt', 'desc');
		if (options.decision) {
			query = query.where('decision', '==', options.decision) as typeof query;
		}
		const snapshot = await query
			.limit(limit)
			.offset((page - 1) * limit)
			.get();
		return snapshot.docs.map((d) => mapVote(d.data(), d.id));
	}

	/**
	 * Total number of votes for a referendum, via count aggregation (no doc reads).
	 * Frozen contract (PR-1): public history `totalCount` is the real total, not
	 * the number of items on the current page. Accepts the same decision filter.
	 */
	async countVotes(index: number, decision?: 'aye' | 'nay' | 'abstain'): Promise<number> {
		let query = referendumDoc(this.db, index).collection('votes');
		if (decision) {
			query = query.where('decision', '==', decision) as typeof query;
		}
		const snapshot = await query.count().get();
		return snapshot.data().count;
	}

	/**
	 * Referendum comments (plan PR-7), oldest first for chronological reading.
	 */
	// eslint-disable-next-line class-methods-use-this
	async listComments(index: number, limit = 50, page = 1): Promise<{ items: ReferendumComment[]; totalCount: number }> {
		const ref = commentsRef(this.db, index);
		const [snapshot, countSnap] = await Promise.all([
			ref
				.orderBy('createdAt', 'asc')
				.limit(Math.max(1, Math.floor(limit)))
				.offset((Math.max(1, Math.floor(page)) - 1) * Math.max(1, Math.floor(limit)))
				.get(),
			ref.count().get()
		]);
		const items = snapshot.docs.map((d) => mapComment(d.data(), d.id));
		return { items, totalCount: countSnap.data().count };
	}

	/**
	 * Batch-read the aggregate stats for a page of referenda using a single
	 * `getAll` round trip (plan PR-6: avoid per-card browser reads).
	 * Missing/corrupt stats map to null so cards can hide metrics gracefully.
	 */
	async getStatsForIndexes(indexes: number[]): Promise<Map<number, ReferendumStats | null>> {
		const result = new Map<number, ReferendumStats | null>();
		if (indexes.length === 0) return result;
		const refs = indexes.map((index) => statsDoc(this.db, index));
		const snapshots = await this.db.getAll(...refs);
		snapshots.forEach((snap, position) => {
			const index = indexes[position];
			result.set(index, snap.exists ? mapStats(snap.data()!) : null);
		});
		return result;
	}

	/**
	 * List referenda feed (most recent first) for server-rendered pages.
	 */
	async listAll(): Promise<Referendum[]> {
		const snapshot = await this.db.collection(REFERENDA_COLLECTION).orderBy('createdAt', 'desc').limit(50).get();
		return snapshot.docs.map((d) => mapReferendum(d.data(), Number(d.id)));
	}
}
