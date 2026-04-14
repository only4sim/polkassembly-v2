// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Poll } from './Poll';

/**
 * DemoPost entity for DemoOS discussion posts.
 *
 * Posts are stored in the Firestore `posts` collection.
 * The `id` field corresponds to the Firestore document ID (auto-generated string).
 */
export interface DemoPost {
	id: string;
	title: string;
	content: string;
	authorUid: string;
	authorName: string;
	/** Topic category for the post (e.g. 'general', 'governance', 'treasury'). */
	topic?: string;
	/** Tag values attached to this post. */
	tags?: string[];
	/** Who is allowed to comment: 'all', 'onchain_verified', or 'none'. */
	allowedCommentor?: string;
	/** Proposal type for Algolia indexing (e.g. 'Discussion'). */
	proposalType?: string;
	/** Network for the post (e.g. 'polkadot'). */
	network?: string;
	/** Map of authorUid → reaction type for post-level reactions. */
	reactions?: Record<string, 'like' | 'dislike'>;
	/** Optional poll attached to this post. */
	poll?: Poll;
	createdAt: Date;
	updatedAt: Date;
}
