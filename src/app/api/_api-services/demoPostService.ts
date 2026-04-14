// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';
import { DemoPost } from '@/domain/entities/Post';

// In development, always ensure emulator env vars are set before any Admin SDK call.
// Use ||= (not ??=) so an empty-string value is also overridden.
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

function docToPost(id: string, data: admin.firestore.DocumentData): DemoPost {
	return {
		id,
		title: data.title ?? '',
		content: data.content ?? '',
		authorUid: data.authorUid ?? '',
		authorName: data.authorName ?? '',
		topic: data.topic ?? undefined,
		tags: Array.isArray(data.tags) ? data.tags : undefined,
		allowedCommentor: data.allowedCommentor ?? undefined,
		proposalType: data.proposalType ?? undefined,
		network: data.network ?? undefined,
		reactions: data.reactions ?? undefined,
		createdAt: data.createdAt?.toDate() ?? new Date(),
		updatedAt: data.updatedAt?.toDate() ?? new Date()
	};
}

export interface CreateDemoPostInput {
	title: string;
	content: string;
	authorUid: string;
	authorName: string;
	topic?: string;
	tags?: string[];
	allowedCommentor?: string;
	proposalType?: string;
	network?: string;
}

export class DemoPostService {
	private static collection() {
		return admin.firestore().collection(POSTS_COLLECTION);
	}

	/**
	 * Create a new discussion post in the `posts` Firestore collection.
	 * Returns the created DemoPost with its auto-generated Firestore document ID.
	 */
	static async createPost(input: CreateDemoPostInput): Promise<DemoPost> {
		const now = new Date();
		const ts = admin.firestore.Timestamp.fromDate(now);
		const ref = await DemoPostService.collection().add({
			title: input.title.trim(),
			content: input.content.trim(),
			authorUid: input.authorUid,
			authorName: input.authorName,
			...(input.topic ? { topic: input.topic } : {}),
			...(input.tags ? { tags: input.tags } : {}),
			...(input.allowedCommentor ? { allowedCommentor: input.allowedCommentor } : {}),
			...(input.proposalType ? { proposalType: input.proposalType } : {}),
			...(input.network ? { network: input.network } : {}),
			createdAt: ts,
			updatedAt: ts
		});
		return {
			id: ref.id,
			title: input.title.trim(),
			content: input.content.trim(),
			authorUid: input.authorUid,
			authorName: input.authorName,
			topic: input.topic,
			tags: input.tags,
			allowedCommentor: input.allowedCommentor,
			proposalType: input.proposalType,
			network: input.network,
			createdAt: now,
			updatedAt: now
		};
	}

	/**
	 * Retrieve all posts ordered by createdAt descending, with optional pagination.
	 */
	static async listPosts(limit = 20, offset = 0): Promise<DemoPost[]> {
		let query: admin.firestore.Query = DemoPostService.collection().orderBy('createdAt', 'desc');
		if (offset > 0) query = query.offset(offset);
		query = query.limit(limit);
		const snapshot = await query.get();
		return snapshot.docs.map((doc) => docToPost(doc.id, doc.data()));
	}

	/**
	 * Retrieve posts authored by a specific user (by UID).
	 */
	static async listPostsByAuthor(authorUid: string, limit = 20): Promise<DemoPost[]> {
		const snapshot = await DemoPostService.collection().where('authorUid', '==', authorUid).orderBy('createdAt', 'desc').limit(limit).get();
		return snapshot.docs.map((doc) => docToPost(doc.id, doc.data()));
	}

	/**
	 * Retrieve a single post by its Firestore document ID.
	 * Returns null if the document does not exist.
	 */
	static async getPostById(id: string): Promise<DemoPost | null> {
		const doc = await DemoPostService.collection().doc(id).get();
		if (!doc.exists) return null;
		return docToPost(doc.id, doc.data()!);
	}

	/**
	 * Toggle a like or dislike reaction on a post.
	 * - If the caller already has the same reaction, it is removed (toggle off).
	 * - If the caller has a different reaction, it is replaced.
	 * - Otherwise the reaction is added.
	 *
	 * Returns the updated reactions map.
	 */
	static async togglePostReaction(postId: string, callerUid: string, reaction: 'like' | 'dislike'): Promise<Record<string, 'like' | 'dislike'>> {
		const ref = DemoPostService.collection().doc(postId);
		const doc = await ref.get();
		if (!doc.exists) throw new Error('Post not found');

		const data = doc.data()!;
		const currentReactions = (data.reactions as Record<string, 'like' | 'dislike'>) ?? {};
		const existingReaction = currentReactions[callerUid];

		let updatedReactions: Record<string, 'like' | 'dislike'>;
		if (existingReaction === reaction) {
			const { [callerUid]: _removed, ...rest } = currentReactions;
			updatedReactions = rest as Record<string, 'like' | 'dislike'>;
		} else {
			updatedReactions = { ...currentReactions, [callerUid]: reaction };
		}

		const ts = admin.firestore.Timestamp.fromDate(new Date());
		await ref.update({ reactions: updatedReactions, updatedAt: ts });

		return updatedReactions;
	}
}
