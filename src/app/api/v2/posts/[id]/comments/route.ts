// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoCommentService } from '@/app/api/_api-services/demoCommentService';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { DemoPostService } from '@/app/api/_api-services/demoPostService';

/**
 * GET /api/v2/posts/[id]/comments
 * Returns all comments for the given post, ordered by createdAt ascending.
 *
 * Query params:
 *   - limit  (number, default 100)
 *   - cursor (string, optional — Firestore document ID to paginate after)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id: postId } = await params;
	if (!postId) {
		return NextResponse.json({ message: 'Post ID is required' }, { status: StatusCodes.BAD_REQUEST });
	}

	const { searchParams } = req.nextUrl;
	const limitParam = parseInt(searchParams.get('limit') || '100', 10);
	const limit = Math.min(Number.isNaN(limitParam) ? 100 : limitParam, 200);
	const cursor = searchParams.get('cursor') || undefined;

	try {
		const comments = await DemoCommentService.listComments(postId, limit, cursor);
		return NextResponse.json({ comments });
	} catch (err) {
		console.error(`[GET /api/v2/posts/${postId}/comments] Failed:`, err);
		return NextResponse.json({ message: 'Failed to fetch comments' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}

/**
 * POST /api/v2/posts/[id]/comments
 * Adds a new comment to the given post. Requires Firebase auth (Bearer token).
 *
 * Body: { content: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id: postId } = await params;
	if (!postId) {
		return NextResponse.json({ message: 'Post ID is required' }, { status: StatusCodes.BAD_REQUEST });
	}

	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const decoded = await DemoAuthService.verifyIdToken(idToken);
	if (!decoded) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	// Verify the post exists
	const post = await DemoPostService.getPostById(postId);
	if (!post) {
		return NextResponse.json({ message: 'Post not found' }, { status: StatusCodes.NOT_FOUND });
	}

	const body = (await req.json().catch(() => ({}))) as { content?: string; parentCommentId?: string };
	const { content, parentCommentId } = body;

	if (!content || typeof content !== 'string' || !content.trim()) {
		return NextResponse.json({ message: 'Content is required' }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		const comment = await DemoCommentService.addComment({
			postId,
			parentCommentId: typeof parentCommentId === 'string' ? parentCommentId : undefined,
			authorUid: decoded.uid,
			authorDisplayName: decoded.name ?? decoded.email ?? 'Anonymous',
			content
		});
		return NextResponse.json({ comment }, { status: StatusCodes.CREATED });
	} catch (err) {
		console.error(`[POST /api/v2/posts/${postId}/comments] Failed:`, err);
		return NextResponse.json({ message: 'Failed to add comment' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}
