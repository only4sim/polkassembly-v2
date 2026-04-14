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
		authorUid: data.authorUid ?? '',
		authorDisplayName: data.authorDisplayName ?? '',
		content: data.content ?? '',
		createdAt: data.createdAt?.toDate() ?? new Date(),
		updatedAt: data.updatedAt?.toDate() ?? new Date()
	};
}

export interface CreateDemoCommentInput {
	postId: string;
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
	static async listComments(postId: string, limit = 100, cursor?: string): Promise<DemoComment[]> {
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
	 * Add a new comment to a post.
	 * Also atomically increments the `commentCount` field on the parent post document.
	 */
	static async addComment(input: CreateDemoCommentInput): Promise<DemoComment> {
		const now = new Date();
		const ts = admin.firestore.Timestamp.fromDate(now);
		const data = {
			postId: input.postId,
			authorUid: input.authorUid,
			authorDisplayName: input.authorDisplayName,
			content: input.content.trim(),
			createdAt: ts,
			updatedAt: ts
		};

		const ref = await DemoCommentService.commentsRef(input.postId).add(data);

		// Atomically increment the comment count on the parent post
		await admin
			.firestore()
			.collection(POSTS_COLLECTION)
			.doc(input.postId)
			.update({ commentCount: admin.firestore.FieldValue.increment(1), updatedAt: ts });

		return {
			id: ref.id,
			postId: input.postId,
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
	 * Also atomically decrements the `commentCount` field on the parent post.
	 */
	static async deleteComment(postId: string, commentId: string, callerUid: string): Promise<void> {
		const ref = DemoCommentService.commentsRef(postId).doc(commentId);
		const doc = await ref.get();
		if (!doc.exists) throw new Error('Comment not found');

		const data = doc.data()!;
		if (data.authorUid !== callerUid) throw new Error('Forbidden');

		const ts = admin.firestore.Timestamp.fromDate(new Date());
		await ref.delete();

		// Atomically decrement the comment count on the parent post
		await admin
			.firestore()
			.collection(POSTS_COLLECTION)
			.doc(postId)
			.update({ commentCount: admin.firestore.FieldValue.increment(-1), updatedAt: ts });
	}
}
