// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { DemoPostService } from '@/app/api/_api-services/demoPostService';

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

	const body = (await req.json().catch(() => ({}))) as { title?: string; content?: string; topic?: string; tags?: string[]; allowedCommentor?: string };
	const { title, content, topic, tags, allowedCommentor } = body;

	if (!title || typeof title !== 'string' || !title.trim()) {
		return NextResponse.json({ message: 'Title is required' }, { status: StatusCodes.BAD_REQUEST });
	}
	if (!content || typeof content !== 'string' || !content.trim()) {
		return NextResponse.json({ message: 'Content is required' }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		const post = await DemoPostService.createPost({
			title,
			content,
			authorUid: decoded.uid,
			authorName: decoded.name ?? decoded.email ?? 'Anonymous',
			topic: typeof topic === 'string' ? topic : undefined,
			tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string') : undefined,
			allowedCommentor: typeof allowedCommentor === 'string' ? allowedCommentor : undefined
		});
		return NextResponse.json({ post }, { status: StatusCodes.CREATED });
	} catch (err) {
		console.error('[POST /api/v2/posts] Failed to create post:', err);
		return NextResponse.json({ message: 'Failed to create post' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}
