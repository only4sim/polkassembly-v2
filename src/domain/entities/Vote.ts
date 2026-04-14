// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * An individual vote cast by a user on a post poll.
 *
 * Stored at `posts/{postId}/votes/{uid}`.
 */
export interface Vote {
	/** Firebase Auth UID of the voter. */
	uid: string;
	/** Indices into poll.options that the user selected, e.g. [0, 2]. */
	selectedOptions: number[];
	/** When the vote was cast. */
	votedAt: Date;
}

/**
 * Aggregated vote statistics for a poll.
 *
 * Stored at `posts/{postId}/stats/votes`.
 */
export interface VoteStats {
	/** Total number of unique voters. */
	totalVoters: number;
	/** Per-option vote counts, indexed by option position. */
	optionCounts: number[];
	/** When the stats were last updated. */
	lastUpdated: Date;
}
