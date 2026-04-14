// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * DemoComment entity for comments on DemoOS discussion posts.
 *
 * Comments are stored in the Firestore subcollection `posts/{postId}/comments`.
 * The `id` field corresponds to the Firestore document ID (auto-generated string).
 */
export interface DemoComment {
	id: string;
	postId: string;
	/** Set when this comment is a reply to another top-level comment. */
	parentCommentId?: string;
	authorUid: string;
	authorDisplayName: string;
	content: string;
	/** Map of authorUid → reaction type. Stored directly on the comment document. */
	reactions?: Record<string, 'like' | 'dislike'>;
	createdAt: Date;
	updatedAt: Date;
}
