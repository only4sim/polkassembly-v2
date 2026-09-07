// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { type Referendum } from '@/domain/entities/Referendum';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';
import { getAdminDb } from '@/adapters/firestore/firestoreInit';
import { FirestoreReferendumRepository } from '@/adapters/firestore/FirestoreReferendumRepository';
import { REFERENDA_COLLECTION, mapReferendum, mapStats, mapVote, referendumDoc, statsDoc, voteDoc } from '@/adapters/firestore/referendaMappers';

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

	async listVotes(index: number, limit = 50): Promise<ReferendumVote[]> {
		const snapshot = await referendumDoc(this.db, index).collection('votes').orderBy('updatedAt', 'desc').limit(limit).get();
		return snapshot.docs.map((d) => mapVote(d.data(), d.id));
	}

	/**
	 * Total number of votes for a referendum, via count aggregation (no doc reads).
	 * Frozen contract (PR-1): public history `totalCount` is the real total, not
	 * the number of items on the current page.
	 */
	async countVotes(index: number): Promise<number> {
		const snapshot = await referendumDoc(this.db, index).collection('votes').count().get();
		return snapshot.data().count;
	}

	/**
	 * List referenda feed (most recent first) for server-rendered pages.
	 */
	async listAll(): Promise<Referendum[]> {
		const snapshot = await this.db.collection(REFERENDA_COLLECTION).orderBy('createdAt', 'desc').limit(50).get();
		return snapshot.docs.map((d) => mapReferendum(d.data(), Number(d.id)));
	}
}
