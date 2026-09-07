// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.
/* eslint-disable sonarjs/prefer-immediate-return, lines-between-class-members, sonarjs/no-duplicate-string */

import { Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import {
	type ReferendumListFilter,
	type ReferendumListPage,
	type ReferendumRepository,
	type ReferendumWrite,
	type CounterRepository
} from '@/ports/repositories/ReferendumRepository';
import { getAdminDb } from './firestoreInit';
import { REFERENDA_COLLECTION, counterDoc, mapReferendum, referendumDoc, statsDoc, emptyStatsData, toReferendumWriteData } from './referendaMappers';

/**
 * Firestore adapter implementing `ReferendumRepository` and `CounterRepository`.
 * Index allocation is transactional against `counters/referenda`.
 * `create()` allocates the counter, writes the referendum doc, and seeds empty
 * stats all within a single Firestore transaction.
 */
export class FirestoreReferendumRepository implements ReferendumRepository, CounterRepository {
	private db = getAdminDb();

	async getByIndex(index: number): Promise<import('@/domain/entities/Referendum').Referendum | null> {
		const snap = await referendumDoc(this.db, index).get();
		if (!snap.exists) return null;
		return mapReferendum(snap.data()!, index);
	}

	async list(filter: ReferendumListFilter): Promise<ReferendumListPage> {
		const { page, pageSize, statuses, origin } = filter;
		let query: admin.firestore.Query = this.db.collection(REFERENDA_COLLECTION).orderBy('createdAt', 'desc');
		if (statuses && statuses.length > 0) {
			query = query.where('status', 'in', statuses);
		}
		if (origin) {
			query = query.where('origin', '==', origin);
		}
		const snapshot = await query
			.limit(pageSize)
			.offset((page - 1) * pageSize)
			.get();

		const items = snapshot.docs.map((doc) => mapReferendum(doc.data(), Number(doc.id)));

		let countQuery: admin.firestore.Query = this.db.collection(REFERENDA_COLLECTION);
		if (statuses && statuses.length > 0) {
			countQuery = countQuery.where('status', 'in', statuses);
		}
		if (origin) {
			countQuery = countQuery.where('origin', '==', origin);
		}
		const countSnap = await countQuery.count().get();
		const totalCount = countSnap.data().count;

		return { items, totalCount };
	}

	/**
	 * Create a referendum with a transactionally-allocated numeric index.
	 * Counter allocation, document creation, and stats seeding happen in one
	 * transaction so a failure does not consume an index without creating the doc.
	 */
	async create(data: ReferendumWrite): Promise<import('@/domain/entities/Referendum').Referendum> {
		return this.db.runTransaction(async (tx) => {
			// 1. Allocate index
			const counterRef = counterDoc(this.db);
			const counterSnap = await tx.get(counterRef);
			const current = (counterSnap.data()?.value as number) ?? 0;
			const index = current + 1;

			// 2. Verify document doesn't already exist at that index
			const ref = referendumDoc(this.db, index);
			const existing = await tx.get(ref);
			if (existing.exists) {
				throw new Error(`Referendum index ${index} already exists.`);
			}

			// 3. Write referendum document
			const now = Timestamp.now();
			tx.set(ref, {
				...toReferendumWriteData(data),
				createdAt: now,
				updatedAt: now
			});

			// 4. Seed empty stats
			tx.set(statsDoc(this.db, index), emptyStatsData(now));

			// 5. Update counter
			tx.set(counterRef, { value: index }, { merge: true });

			const created = mapReferendum(
				{
					...toReferendumWriteData(data),
					createdAt: now,
					updatedAt: now
				} as Record<string, unknown>,
				index
			);

			return created;
		});
	}

	async update(index: number, updates: Partial<Pick<import('@/domain/entities/Referendum').Referendum, 'status' | 'closedAt' | 'updatedAt' | 'title' | 'content'>>): Promise<void> {
		const patch: Record<string, unknown> = { updatedAt: Timestamp.now() };
		if (updates.status) patch.status = updates.status;
		if (updates.closedAt !== undefined) patch.closedAt = Timestamp.fromDate(new Date(updates.closedAt));
		if (updates.title) patch.title = updates.title;
		if (updates.content) patch.content = updates.content;
		await referendumDoc(this.db, index).update(patch);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
	async next(_name: string): Promise<number> {
		const ref = counterDoc(this.db);
		return this.db.runTransaction(async (tx) => {
			const snap = await tx.get(ref);
			const current = (snap.data()?.value as number) ?? 0;
			const nextVal = current + 1;
			tx.set(ref, { value: nextVal }, { merge: true });
			return nextVal;
		});
	}
}
