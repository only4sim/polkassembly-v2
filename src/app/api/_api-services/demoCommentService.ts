// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';
import { DemoComment } from '@/domain/entities/Comment';

if (process.env.NODE_ENV === 'development') {
	process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099';
	process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
}

if (!admin.apps.length) {
	if (FIREBASE_SERVICE_ACC_CONFIG) {
		admin.initializeApp({
			credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACC_CONFIG))
		});
	} else {
		admin.initializeApp({
			projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cbs-assembly'
		});
	}
}

const POSTS_COLLECTION = 'posts';
const COMMENTS_SUBCOLLECTION = 'comments';

function docToComment(id: string, data: admin.firestore.DocumentData, postId: string): DemoComment {
	return {
		id,
		postId,
		parentCommentId: data.parentCommentId ?? undefined,
		authorUid: data.authorUid ?? '',
		authorDisplayName: data.authorDisplayName ?? '',
		content: data.content ?? '',
		reactions: data.reactions ?? undefined,
		createdAt: data.createdAt?.toDate() ?? new Date(),
		updatedAt: data.updatedAt?.toDate() ?? new Date()
	};
}

export interface CreateDemoCommentInput {
	postId: string;
	parentCommentId?: string;
	authorUid: string;
	authorDisplayName: string;
	content: string;
}

export class DemoCommentService {
	private static commentsRef(postId: string) {
		return admin.firestore().collection(POSTS_COLLECTION).doc(postId).collection(COMMENTS_SUBCOLLECTION);
	}

	/**
	 * List comments for a post, ordered by createdAt ascending.
	 */
	static async listComments(postId: string, limit = 200, cursor?: string): Promise<DemoComment[]> {
		let query: admin.firestore.Query = DemoCommentService.commentsRef(postId).orderBy('createdAt', 'asc');

		if (cursor) {
			const cursorDoc = await DemoCommentService.commentsRef(postId).doc(cursor).get();
			if (cursorDoc.exists) {
				query = query.startAfter(cursorDoc);
			}
		}

		query = query.limit(limit);
		const snapshot = await query.get();
		return snapshot.docs.map((doc) => docToComment(doc.id, doc.data(), postId));
	}

	/**
	 * Add a new comment to a post (or a reply to an existing comment).
	 * The `commentCount` on the parent post is updated by the `onCommentWritten`
	 * Cloud Function trigger to avoid double-counting.
	 */
	static async addComment(input: CreateDemoCommentInput): Promise<DemoComment> {
		const now = new Date();
		const ts = admin.firestore.Timestamp.fromDate(now);
		const data: admin.firestore.DocumentData = {
			postId: input.postId,
			authorUid: input.authorUid,
			authorDisplayName: input.authorDisplayName,
			content: input.content.trim(),
			createdAt: ts,
			updatedAt: ts
		};

		if (input.parentCommentId) {
			data.parentCommentId = input.parentCommentId;
		}

		const ref = await DemoCommentService.commentsRef(input.postId).add(data);

		return {
			id: ref.id,
			postId: input.postId,
			parentCommentId: input.parentCommentId,
			authorUid: input.authorUid,
			authorDisplayName: input.authorDisplayName,
			content: input.content.trim(),
			createdAt: now,
			updatedAt: now
		};
	}

	/**
	 * Update the content of an existing comment.
	 * Verifies the caller owns the comment before updating.
	 * Returns the updated comment.
	 */
	static async updateComment(postId: string, commentId: string, callerUid: string, content: string): Promise<DemoComment> {
		const ref = DemoCommentService.commentsRef(postId).doc(commentId);
		const doc = await ref.get();
		if (!doc.exists) throw new Error('Comment not found');

		const data = doc.data()!;
		if (data.authorUid !== callerUid) throw new Error('Forbidden');

		const ts = admin.firestore.Timestamp.fromDate(new Date());
		await ref.update({ content: content.trim(), updatedAt: ts });

		return docToComment(commentId, { ...data, content: content.trim(), updatedAt: ts }, postId);
	}

	/**
	 * Delete a comment.
	 * Verifies the caller owns the comment before deleting.
	 * The `commentCount` on the parent post is updated by the `onCommentWritten`
	 * Cloud Function trigger to avoid double-counting.
	 */
	static async deleteComment(postId: string, commentId: string, callerUid: string): Promise<void> {
		const ref = DemoCommentService.commentsRef(postId).doc(commentId);
		const doc = await ref.get();
		if (!doc.exists) throw new Error('Comment not found');

		const data = doc.data()!;
		if (data.authorUid !== callerUid) throw new Error('Forbidden');

		await ref.delete();
	}

	/**
	 * Toggle a like or dislike reaction on a comment.
	 * - If the caller already has the same reaction, it is removed (toggle off).
	 * - If the caller has a different reaction, it is replaced.
	 * - Otherwise the reaction is added.
	 *
	 * Reactions are stored as a map field on the comment document:
	 * `reactions: { [authorUid]: 'like' | 'dislike' }`
	 */
	static async toggleReaction(postId: string, commentId: string, callerUid: string, reaction: 'like' | 'dislike'): Promise<Record<string, 'like' | 'dislike'>> {
		const ref = DemoCommentService.commentsRef(postId).doc(commentId);
		const doc = await ref.get();
		if (!doc.exists) throw new Error('Comment not found');

		const data = doc.data()!;
		const currentReactions = (data.reactions as Record<string, 'like' | 'dislike'>) ?? {};
		const existingReaction = currentReactions[callerUid];

		let updatedReactions: Record<string, 'like' | 'dislike'>;
		if (existingReaction === reaction) {
			// Same reaction — remove it (toggle off)
			const { [callerUid]: _removed, ...rest } = currentReactions;
			updatedReactions = rest as Record<string, 'like' | 'dislike'>;
		} else {
			// Different or no reaction — set new one
			updatedReactions = { ...currentReactions, [callerUid]: reaction };
		}

		const ts = admin.firestore.Timestamp.fromDate(new Date());
		await ref.update({ reactions: updatedReactions, updatedAt: ts });

		return updatedReactions;
	}
}
