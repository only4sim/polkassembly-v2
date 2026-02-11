// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { EAllowedCommentor, EDataSource, ENetwork, EOffChainPostTopic, EProposalType, IContentSummary, IPostLink, IPostOffChainMetrics, ITag } from '@/_shared/types';

/**
 * Post entity representing governance posts/proposals
 */
export interface Post {
	id: number;
	network: ENetwork;
	type: EProposalType;
	title: string;
	content: string;
	proposerAddress: string;
	userId: number;
	createdAt: Date;
	updatedAt: Date;

	// Optional metadata
	tags?: ITag[];
	topic?: EOffChainPostTopic;
	source?: EDataSource;
	allowedCommentors?: EAllowedCommentor;
	summary?: IContentSummary;
	metrics?: IPostOffChainMetrics;
	links?: IPostLink[];
}

/**
 * Input for creating a new post
 */
export interface CreatePostInput {
	network: ENetwork;
	type: EProposalType;
	postId: number;
	title: string;
	content: string;
	proposerAddress: string;
	userId: number;
	tags?: ITag[];
	topic?: EOffChainPostTopic;
}

/**
 * Input for updating an existing post
 */
export interface UpdatePostInput {
	title?: string;
	content?: string;
	tags?: ITag[];
	topic?: EOffChainPostTopic;
	allowedCommentors?: EAllowedCommentor;
	summary?: IContentSummary;
}

/**
 * Query options for listing posts
 */
export interface ListPostsOptions {
	network: ENetwork;
	type?: EProposalType;
	topic?: EOffChainPostTopic;
	userId?: number;
	limit?: number;
	offset?: number;
	sortBy?: 'createdAt' | 'updatedAt' | 'title';
	sortOrder?: 'asc' | 'desc';
}

/**
 * Repository interface for Post data access
 *
 * This port defines the contract for post persistence operations.
 * Implementations (adapters) can use Firestore, PostgreSQL, or any other data store.
 */
export interface PostRepository {
	/**
	 * Retrieve a single post by its composite key
	 * @param network - Blockchain network (e.g., 'polkadot', 'kusama')
	 * @param postId - On-chain post/proposal ID
	 * @param type - Proposal type (e.g., 'referendums', 'treasury_proposals')
	 * @returns Post if found, null otherwise
	 */
	getPostById(network: ENetwork, postId: number, type: EProposalType): Promise<Post | null>;

	/**
	 * Create a new post
	 * @param input - Post creation data
	 * @returns Created post with generated metadata
	 */
	createPost(input: CreatePostInput): Promise<Post>;

	/**
	 * Update an existing post
	 * @param network - Blockchain network
	 * @param postId - Post ID
	 * @param type - Proposal type
	 * @param updates - Partial post data to update
	 */
	updatePost(network: ENetwork, postId: number, type: EProposalType, updates: UpdatePostInput): Promise<void>;

	/**
	 * Delete a post (soft delete or hard delete based on implementation)
	 * @param network - Blockchain network
	 * @param postId - Post ID
	 * @param type - Proposal type
	 */
	deletePost(network: ENetwork, postId: number, type: EProposalType): Promise<void>;

	/**
	 * List posts with optional filtering and pagination
	 * @param options - Query options (filters, pagination, sorting)
	 * @returns Array of posts matching the criteria
	 */
	listPosts(options: ListPostsOptions): Promise<Post[]>;

	/**
	 * Count total posts matching criteria
	 * @param network - Blockchain network
	 * @param type - Optional proposal type filter
	 * @returns Total count
	 */
	countPosts(network: ENetwork, type?: EProposalType): Promise<number>;

	/**
	 * Update post metrics (reactions, comments, votes)
	 * @param network - Blockchain network
	 * @param postId - Post ID
	 * @param type - Proposal type
	 * @param metrics - Updated metrics
	 */
	updateMetrics(network: ENetwork, postId: number, type: EProposalType, metrics: Partial<IPostOffChainMetrics>): Promise<void>;
}
