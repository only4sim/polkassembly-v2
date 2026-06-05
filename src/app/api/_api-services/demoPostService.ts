// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';
import { DemoPost } from '@/domain/entities/Post';

// In development, always ensure emulator env vars are set before any Admin SDK call.
// Use ||= (not ??=) so an empty-string value is also overridden.
if (process.env.NODE_ENV === 'development') {
	process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
	process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
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
	// Deserialise the optional poll sub-document
	let poll: DemoPost['poll'];
	if (data.poll && typeof data.poll === 'object') {
		poll = {
			question: data.poll.question ?? '',
			options: Array.isArray(data.poll.options) ? data.poll.options : [],
			endDate: data.poll.endDate?.toDate ? data.poll.endDate.toDate() : undefined
		};
	}

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
		poll,
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
	poll?: {
		question: string;
		options: string[];
		endDate?: Date;
	};
}

export class DemoPostService {
	private static collection() {
		return admin.firestore().collection(POSTS_COLLECTION);
	}

	private static ensureOwner(post: DemoPost | null, callerUid: string) {
		if (!post) {
			throw new Error('Post not found');
		}

		if (post.authorUid !== callerUid) {
			throw new Error('You are not authorized to modify this post');
		}

		return post;
	}

	/**
	 * Create a new discussion post in the `posts` Firestore collection.
	 * Returns the created DemoPost with its auto-generated Firestore document ID.
	 */
	static async createPost(input: CreateDemoPostInput): Promise<DemoPost> {
		const now = new Date();
		const ts = admin.firestore.Timestamp.fromDate(now);

		// Serialise the poll sub-document when provided
		let pollPayload: Record<string, unknown> | undefined;
		if (input.poll) {
			pollPayload = {
				question: input.poll.question,
				options: input.poll.options,
				...(input.poll.endDate ? { endDate: admin.firestore.Timestamp.fromDate(input.poll.endDate) } : {})
			};
		}

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
			...(pollPayload ? { poll: pollPayload } : {}),
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
			poll: input.poll,
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
	 * Update an existing discussion post.
	 */
	static async updatePost(
		id: string,
		callerUid: string,
		input: {
			title?: string;
			content?: string;
			topic?: string;
			tags?: string[];
			allowedCommentor?: string;
		}
	): Promise<DemoPost> {
		const existingPost = DemoPostService.ensureOwner(await DemoPostService.getPostById(id), callerUid);

		const updates: Record<string, unknown> = {
			updatedAt: admin.firestore.Timestamp.fromDate(new Date())
		};

		if (typeof input.title === 'string') updates.title = input.title.trim();
		if (typeof input.content === 'string') updates.content = input.content.trim();
		if (typeof input.topic === 'string') updates.topic = input.topic.trim();
		if (Array.isArray(input.tags)) updates.tags = input.tags;
		if (typeof input.allowedCommentor === 'string') updates.allowedCommentor = input.allowedCommentor;

		await DemoPostService.collection().doc(id).update(updates);
		return {
			...existingPost,
			...(typeof input.title === 'string' ? { title: input.title.trim() } : {}),
			...(typeof input.content === 'string' ? { content: input.content.trim() } : {}),
			...(typeof input.topic === 'string' ? { topic: input.topic.trim() || undefined } : {}),
			...(Array.isArray(input.tags) ? { tags: input.tags } : {}),
			...(typeof input.allowedCommentor === 'string' ? { allowedCommentor: input.allowedCommentor } : {}),
			updatedAt: new Date()
		};
	}

	/**
	 * Delete a discussion post.
	 */
	static async deletePost(id: string, callerUid: string): Promise<void> {
		const existingPost = DemoPostService.ensureOwner(await DemoPostService.getPostById(id), callerUid);
		await DemoPostService.collection().doc(existingPost.id).delete();
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
		const existingReaction = Object.entries(currentReactions).find(([uid]) => uid === callerUid)?.[1];

		let updatedReactions: Record<string, 'like' | 'dislike'>;
		if (existingReaction === reaction) {
			updatedReactions = Object.fromEntries(Object.entries(currentReactions).filter(([uid]) => uid !== callerUid)) as Record<string, 'like' | 'dislike'>;
		} else {
			updatedReactions = { ...currentReactions, [callerUid]: reaction };
		}

		const ts = admin.firestore.Timestamp.fromDate(new Date());
		await ref.update({ reactions: updatedReactions, updatedAt: ts });

		return updatedReactions;
	}
}
