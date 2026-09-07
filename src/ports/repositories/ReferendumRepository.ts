// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { type Referendum } from '@/domain/entities/Referendum';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';

export interface ReferendumListFilter {
	page: number;
	pageSize: number;
	statuses?: string[];
}

export interface ReferendumListPage {
	items: Referendum[];
	totalCount: number;
}

export type ReferendumWrite = Omit<Referendum, 'index' | 'createdAt' | 'updatedAt' | 'closedAt'>;

/**
 * Data-access contract for points-based referenda.
 */
export interface ReferendumRepository {
	getByIndex(index: number): Promise<Referendum | null>;
	list(filter: ReferendumListFilter): Promise<ReferendumListPage>;
	/** Create a referendum with a transactionally-allocated stable numeric index. */
	create(data: ReferendumWrite): Promise<Referendum>;
	/** Update an existing referendum (lifecycle/admin fields). */
	update(index: number, updates: Partial<Pick<Referendum, 'status' | 'closedAt' | 'updatedAt' | 'title' | 'content'>>): Promise<void>;
}

/**
 * Data-access contract for referendum votes (`referenda/{index}/votes/{uid}`).
 */
export interface ReferendumVoteRepository {
	get(index: number, uid: string): Promise<ReferendumVote | null>;
	list(index: number, limit?: number): Promise<ReferendumVote[]>;
}

/**
 * Data-access contract for aggregate stats (`referenda/{index}/stats/current`).
 */
export interface ReferendumStatsRepository {
	get(index: number): Promise<ReferendumStats | null>;
}

/**
 * Monotonic counter allocation. `counters/{name}` holds a `value` used to derive
 * stable numeric indexes. Never allocate from collection count or last-document.
 */
export interface CounterRepository {
	/** Transactionally allocate the next value for the given counter name. */
	next(name: string): Promise<number>;
}
