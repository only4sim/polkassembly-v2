// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';
import { DemoComment } from '@/domain/entities/Comment';
import { CommentRepository, CreateCommentInput, UpdateCommentInput } from '@/ports/repositories/CommentRepository';

if (process.env.NODE_ENV === 'development') {
	process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
	process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099';
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

/**
 * Map a Firestore document snapshot to a DemoComment entity.
 */
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

/**
 * Firestore implementation of CommentRepository.
 *
 * Subcollection path: posts/{postId}/comments/{commentId}
 */
export class FirestoreCommentRepository implements CommentRepository {
	private db = admin.firestore();

	private commentsRef(postId: string): admin.firestore.CollectionReference {
		return this.db.collection('posts').doc(postId).collection('comments');
	}

	async getCommentsByPostId(postId: string, limit?: number, cursor?: string): Promise<DemoComment[]> {
		const finalLimit = limit ?? 100;
		let query: admin.firestore.Query = this.commentsRef(postId).orderBy('createdAt', 'asc');

		if (cursor) {
			const cursorDoc = await this.commentsRef(postId).doc(cursor).get();
			if (cursorDoc.exists) {
				query = query.startAfter(cursorDoc);
			}
		}

		query = query.limit(finalLimit);
		const snapshot = await query.get();
		return snapshot.docs.map((doc) => docToComment(doc.id, doc.data(), postId));
	}

	async addComment(input: CreateCommentInput): Promise<DemoComment> {
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
		const ref = await this.commentsRef(input.postId).add(data);

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

	async updateComment(postId: string, commentId: string, updates: UpdateCommentInput): Promise<DemoComment> {
		const ts = admin.firestore.Timestamp.fromDate(new Date());
		const ref = this.commentsRef(postId).doc(commentId);

		// Check existence before attempting update
		const doc = await ref.get();
		if (!doc.exists) throw new Error('Comment not found');

		await ref.update({ content: updates.content.trim(), updatedAt: ts });
		return docToComment(commentId, { ...doc.data()!, content: updates.content.trim(), updatedAt: ts }, postId);
	}

	async deleteComment(postId: string, commentId: string): Promise<void> {
		await this.commentsRef(postId).doc(commentId).delete();
	}

	async countComments(postId: string): Promise<number> {
		const snapshot = await this.commentsRef(postId).count().get();
		return snapshot.data().count;
	}
}
