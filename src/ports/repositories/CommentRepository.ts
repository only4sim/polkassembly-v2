// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { DemoComment } from '@/domain/entities/Comment';

export interface CreateCommentInput {
	postId: string;
	authorUid: string;
	authorDisplayName: string;
	content: string;
}

export interface UpdateCommentInput {
	content: string;
}

/**
 * Repository interface for DemoComment data access.
 *
 * This port defines the contract for comment persistence operations on DemoOS posts.
 * Implementations (adapters) can use Firestore or any other data store.
 */
export interface CommentRepository {
	/**
	 * Retrieve all comments for a given post, ordered by createdAt ascending.
	 * @param postId - The Firestore document ID of the parent post
	 * @param limit  - Maximum number of comments to return (default 100)
	 * @param cursor - Optional Firestore document ID to start after (for pagination)
	 */
	getCommentsByPostId(postId: string, limit?: number, cursor?: string): Promise<DemoComment[]>;

	/**
	 * Create a new comment on a post.
	 * @param input - Comment creation data
	 */
	addComment(input: CreateCommentInput): Promise<DemoComment>;

	/**
	 * Update the content of an existing comment.
	 * @param postId    - Parent post document ID
	 * @param commentId - Comment document ID
	 * @param updates   - Fields to update
	 */
	updateComment(postId: string, commentId: string, updates: UpdateCommentInput): Promise<DemoComment>;

	/**
	 * Delete a comment (hard delete).
	 * @param postId    - Parent post document ID
	 * @param commentId - Comment document ID
	 */
	deleteComment(postId: string, commentId: string): Promise<void>;

	/**
	 * Count total comments for a post.
	 * @param postId - The Firestore document ID of the parent post
	 */
	countComments(postId: string): Promise<number>;
}
