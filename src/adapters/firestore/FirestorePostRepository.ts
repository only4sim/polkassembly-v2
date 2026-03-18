// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';
import { ENetwork, EProposalType, EReaction, IPostOffChainMetrics } from '@/_shared/types';
import { CreatePostInput, ListPostsOptions, Post, PostRepository, UpdatePostInput } from '@/ports/repositories/PostRepository';

// In development, always set emulator env vars so the Admin SDK routes to local
// emulators. Use ||= (not ??=) so an empty-string value is also overridden.
if (process.env.NODE_ENV === 'development') {
	process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
	process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099';
}

// Initialize firebase-admin once across all modules.
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
 * Map a Firestore document snapshot to a Post entity.
 */
function docToPost(_id: string, data: admin.firestore.DocumentData): Post {
	return {
		id: data.id ?? 0,
		network: data.network,
		type: data.type,
		title: data.title,
		content: data.content,
		proposerAddress: data.proposerAddress ?? '',
		userId: data.userId ?? 0,
		createdAt: data.createdAt?.toDate() ?? new Date(),
		updatedAt: data.updatedAt?.toDate() ?? new Date(),
		tags: data.tags,
		topic: data.topic,
		source: data.source,
		allowedCommentors: data.allowedCommentors,
		summary: data.summary,
		metrics: data.metrics,
		links: data.links
	};
}

/**
 * Firestore implementation of PostRepository.
 *
 * Collection: posts_{network} (e.g. posts_polkadot)
 * Document ID: {type}_{postId} (e.g. Discussion_42)
 */
export class FirestorePostRepository implements PostRepository {
	private db = admin.firestore();

	private collectionRef(network: ENetwork): admin.firestore.CollectionReference {
		return this.db.collection(`posts_${network}`);
	}

	private docRef(network: ENetwork, postId: number, type: EProposalType) {
		return this.collectionRef(network).doc(`${type}_${postId}`);
	}

	/**
	 * Retrieve a single post by its composite key.
	 *
	 * - Collection: posts_{network}
	 * - Document path: {type}_{postId}
	 */
	async getPostById(network: ENetwork, postId: number, type: EProposalType): Promise<Post | null> {
		const doc = await this.docRef(network, postId, type).get();
		if (!doc.exists) return null;
		return docToPost(doc.id, doc.data()!);
	}

	/**
	 * Create a new post.
	 *
	 * - Generates timestamps (createdAt, updatedAt)
	 * - Initialises metrics with zeros
	 * - Stores document at posts_{network}/{type}_{postId}
	 */
	async createPost(input: CreatePostInput): Promise<Post> {
		const now = new Date();
		const ts = admin.firestore.Timestamp.fromDate(now);
		const postData = {
			id: input.postId,
			network: input.network,
			type: input.type,
			title: input.title,
			content: input.content,
			proposerAddress: input.proposerAddress,
			userId: input.userId,
			tags: input.tags ?? [],
			topic: input.topic ?? undefined,
			metrics: {
				comments: 0,
				reactions: Object.values(EReaction).reduce<Record<EReaction, number>>((acc, r) => ({ ...acc, [r]: 0 }), {} as Record<EReaction, number>)
			},
			createdAt: ts,
			updatedAt: ts
		};
		await this.docRef(input.network, input.postId, input.type).set(postData);
		return {
			...postData,
			createdAt: now,
			updatedAt: now
		};
	}

	/**
	 * Update an existing post.
	 *
	 * - Sets updatedAt timestamp
	 * - Uses Firestore update() for partial updates
	 */
	async updatePost(network: ENetwork, postId: number, type: EProposalType, updates: UpdatePostInput): Promise<void> {
		await this.docRef(network, postId, type).update({
			...updates,
			updatedAt: admin.firestore.Timestamp.fromDate(new Date())
		});
	}

	/**
	 * Delete a post (hard delete).
	 */
	async deletePost(network: ENetwork, postId: number, type: EProposalType): Promise<void> {
		await this.docRef(network, postId, type).delete();
	}

	/**
	 * List posts with optional filtering and pagination.
	 *
	 * - Filters: type, topic, userId
	 * - Sorting: createdAt desc by default
	 * - Pagination: limit + offset
	 */
	async listPosts(options: ListPostsOptions): Promise<Post[]> {
		let query: admin.firestore.Query = this.collectionRef(options.network);
		if (options.type) query = query.where('type', '==', options.type);
		if (options.topic) query = query.where('topic', '==', options.topic);
		if (options.userId !== undefined) query = query.where('userId', '==', options.userId);
		query = query.orderBy(options.sortBy || 'createdAt', options.sortOrder || 'desc');
		if (options.offset) query = query.offset(options.offset);
		query = query.limit(options.limit || 10);
		const snapshot = await query.get();
		return snapshot.docs.map((doc) => docToPost(doc.id, doc.data()));
	}

	/**
	 * Count total posts matching criteria.
	 */
	async countPosts(network: ENetwork, type?: EProposalType): Promise<number> {
		let query: admin.firestore.Query = this.collectionRef(network);
		if (type) query = query.where('type', '==', type);
		const snapshot = await query.count().get();
		return snapshot.data().count;
	}

	/**
	 * Update post metrics using atomic FieldValue increments.
	 */
	async updateMetrics(network: ENetwork, postId: number, type: EProposalType, metrics: Partial<IPostOffChainMetrics>): Promise<void> {
		const updates: Record<string, unknown> = {
			updatedAt: admin.firestore.Timestamp.fromDate(new Date())
		};
		if (metrics.comments !== undefined) updates['metrics.comments'] = admin.firestore.FieldValue.increment(metrics.comments);
		if (metrics.reactions !== undefined) {
			Object.entries(metrics.reactions).forEach(([reaction, delta]) => {
				updates[`metrics.reactions.${reaction}`] = admin.firestore.FieldValue.increment(delta);
			});
		}
		await this.docRef(network, postId, type).update(updates);
	}
}

/**
 * MIGRATION NOTES:
 *
 * 1. Current Implementation Location:
 *    - src/app/api/_api-services/offchain_db_service/firestore_service/index.ts
 *    - Contains GetPostByIndex(), CreatePost(), UpdatePost(), etc.
 *
 * 2. Migration Steps:
 *    a. Copy relevant Firestore logic from FirestoreService class methods
 *    b. Adapt to PostRepository interface signatures
 *    c. Remove static methods, use instance methods
 *    d. Add dependency injection for Firestore connection
 *    e. Update API routes to use this adapter via PostRepository interface
 *
 * 3. Firestore Collection Structure:
 *    - Collection: posts_{network} (e.g., posts_polkadot)
 *    - Document ID: {type}_{postId} (e.g., referendums_v2_123)
 *    - Subcollections: comments, reactions, subscriptions
 *
 * 4. Related Methods in Current FirestoreService:
 *    - GetPostByIndex() → maps to getPostById()
 *    - CreatePost() → maps to createPost()
 *    - UpdatePost() → maps to updatePost()
 *    - GetPostsByNetwork() → maps to listPosts()
 *    - IncrementPostMetrics() → maps to updateMetrics()
 *
 * 5. Testing Checklist:
 *    - [ ] Test with Firestore emulator
 *    - [ ] Verify timestamp conversions (Firestore Timestamp ↔ Date)
 *    - [ ] Test error cases (document not found, network errors)
 *    - [ ] Test pagination and filtering
 *    - [ ] Verify metrics increment atomicity
 */
