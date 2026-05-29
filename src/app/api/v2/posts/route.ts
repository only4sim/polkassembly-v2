// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { DemoPostService } from '@/app/api/_api-services/demoPostService';
import { getNetworkFromHeaders } from '@/app/api/_api-utils/getNetworkFromHeaders';
import { EProposalType } from '@/_shared/types';
import { getSharedEnvVars } from '@/_shared/_utils/getSharedEnvVars';
import { ALGOLIA_WRITE_API_KEY } from '@/app/api/_api-constants/apiEnvVars';
import { algoliasearch } from 'algoliasearch';

type CreatePostBody = {
	title?: string;
	content?: string;
	topic?: string;
	tags?: string[];
	allowedCommentor?: string;
	poll?: { question?: string; options?: string[]; endDate?: string };
};

type ValidatedCreatePostBody = {
	title: string;
	content: string;
	topic?: string;
	tags?: string[];
	allowedCommentor?: string;
	pollInput?: { question: string; options: string[]; endDate?: Date };
};

function validateCreatePostBody(body: CreatePostBody): { error?: string } & Partial<ValidatedCreatePostBody> {
	const { title, content, topic, tags, allowedCommentor, poll } = body;

	if (!title || typeof title !== 'string' || !title.trim()) {
		return { error: 'Title is required' };
	}
	if (!content || typeof content !== 'string' || !content.trim()) {
		return { error: 'Content is required' };
	}

	if (!poll) {
		return { title, content, topic, tags, allowedCommentor };
	}

	if (!poll.question || typeof poll.question !== 'string' || !poll.question.trim()) {
		return { error: 'Poll question is required' };
	}
	if (!Array.isArray(poll.options) || poll.options.length < 2) {
		return { error: 'Poll requires at least 2 options' };
	}

	const filteredOptions = poll.options.filter((option) => typeof option === 'string' && option.trim());
	if (filteredOptions.length < 2) {
		return { error: 'Poll requires at least 2 non-empty options' };
	}

	return {
		title,
		content,
		topic,
		tags,
		allowedCommentor,
		pollInput: {
			question: poll.question.trim(),
			options: filteredOptions.map((option) => option.trim()),
			endDate: poll.endDate ? new Date(poll.endDate) : undefined
		}
	};
}

/**
 * GET /api/v2/posts
 * Returns a paginated list of all discussion posts, ordered by createdAt desc.
 *
 * Query params:
 *   - limit  (number, default 20)
 *   - offset (number, default 0)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
	const { searchParams } = req.nextUrl;
	const limitParam = parseInt(searchParams.get('limit') || '20', 10);
	const offsetParam = parseInt(searchParams.get('offset') || '0', 10);
	const limit = Math.min(Number.isNaN(limitParam) ? 20 : limitParam, 100);
	const offset = Math.max(Number.isNaN(offsetParam) ? 0 : offsetParam, 0);

	try {
		const posts = await DemoPostService.listPosts(limit, offset);
		return NextResponse.json({ posts });
	} catch (err) {
		console.error('[GET /api/v2/posts] Failed to list posts:', err);
		return NextResponse.json({ message: 'Failed to fetch posts' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}

/**
 * POST /api/v2/posts
 * Creates a new discussion post. Requires Firebase auth (Bearer token).
 *
 * Body: { title: string, content: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const decoded = await DemoAuthService.verifyIdToken(idToken);
	if (!decoded) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const body = (await req.json().catch(() => ({}))) as CreatePostBody;
	const validatedBody = validateCreatePostBody(body);
	if (validatedBody.error) {
		return NextResponse.json({ message: validatedBody.error }, { status: StatusCodes.BAD_REQUEST });
	}

	const { title, content, topic, tags, allowedCommentor, pollInput } = validatedBody as ValidatedCreatePostBody;

	try {
		const network = await getNetworkFromHeaders();
		const { NEXT_PUBLIC_ALGOLIA_APP_ID } = getSharedEnvVars();

		const post = await DemoPostService.createPost({
			title,
			content,
			authorUid: decoded.uid,
			authorName: decoded.name ?? decoded.email ?? 'Anonymous',
			topic: typeof topic === 'string' ? topic : undefined,
			tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string') : undefined,
			allowedCommentor: typeof allowedCommentor === 'string' ? allowedCommentor : undefined,
			proposalType: EProposalType.DISCUSSION,
			network,
			poll: pollInput
		});

		// Sync to Algolia after creation
		if (NEXT_PUBLIC_ALGOLIA_APP_ID && ALGOLIA_WRITE_API_KEY) {
			try {
				const client = algoliasearch(NEXT_PUBLIC_ALGOLIA_APP_ID, ALGOLIA_WRITE_API_KEY);
				const algoliaPost = {
					objectID: post.id,
					documentId: post.id,
					firestoreId: post.id,
					title: post.title,
					content: post.content,
					proposalType: EProposalType.DISCUSSION,
					network,
					topic: post.topic || '',
					tags: post.tags || [],
					dataSource: 'polkassembly',
					userId: 0,
					hash: post.id,
					index: 0,
					parsedContent: post.content,
					titleAndContentHash: '',
					proposer: '',
					origin: '',
					createdAtTimestamp: Math.floor(post.createdAt.getTime() / 1000),
					updatedAtTimestamp: Math.floor(post.updatedAt.getTime() / 1000),
					allowedCommentor: post.allowedCommentor || 'all'
				};

				await client.saveObject({
					indexName: 'polkassembly_v2_posts',
					body: algoliaPost
				});

				console.log(`[POST /api/v2/posts] Synced post ${post.id} to Algolia`);
			} catch (algoliaError) {
				console.warn('[POST /api/v2/posts] Failed to sync post to Algolia:', algoliaError);
				// Don't fail the request if Algolia sync fails
			}
		}

		return NextResponse.json({ post }, { status: StatusCodes.CREATED });
	} catch (err) {
		console.error('[POST /api/v2/posts] Failed to create post:', err);
		return NextResponse.json({ message: 'Failed to create post' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}
