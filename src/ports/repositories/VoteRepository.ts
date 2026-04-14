// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Vote, VoteStats } from '@/domain/entities/Vote';

/**
 * Repository interface for Vote data access.
 *
 * This port defines the contract for vote persistence operations.
 * Implementations (adapters) can use Firestore or any other data store.
 */
export interface VoteRepository {
	/**
	 * Cast a vote for a user on a post poll.
	 * Throws if the user has already voted or has insufficient points.
	 *
	 * @param postId - Firestore document ID of the post
	 * @param uid    - Firebase Auth UID of the voter
	 * @param selectedOptions - Indices into poll.options chosen by the user
	 */
	castVote(postId: string, uid: string, selectedOptions: number[]): Promise<void>;

	/**
	 * Retrieve the vote cast by a specific user on a post, or null if not voted.
	 */
	getVote(postId: string, uid: string): Promise<Vote | null>;

	/**
	 * Retrieve the aggregated vote statistics for a post poll.
	 * Returns null if no votes have been cast yet.
	 */
	getVoteStats(postId: string): Promise<VoteStats | null>;
}
