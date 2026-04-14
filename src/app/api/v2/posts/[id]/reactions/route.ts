// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoPostService } from '@/app/api/_api-services/demoPostService';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';

/**
 * POST /api/v2/posts/[id]/reactions
 * Toggle a like or dislike reaction on a post. Requires Firebase auth.
 *
 * Body: { reaction: 'like' | 'dislike' }
 *
 * Returns: `{ reactions: Record<string, 'like' | 'dislike'> }`
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id: postId } = await params;

	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const decoded = await DemoAuthService.verifyIdToken(idToken);
	if (!decoded) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const body = (await req.json().catch(() => ({}))) as { reaction?: string };
	const { reaction } = body;

	if (reaction !== 'like' && reaction !== 'dislike') {
		return NextResponse.json({ message: 'reaction must be "like" or "dislike"' }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		const reactions = await DemoPostService.togglePostReaction(postId, decoded.uid, reaction);
		return NextResponse.json({ reactions });
	} catch (err) {
		const message = (err as Error).message;
		if (message === 'Post not found') {
			return NextResponse.json({ message: 'Post not found' }, { status: StatusCodes.NOT_FOUND });
		}
		console.error(`[POST /api/v2/posts/${postId}/reactions] Failed:`, err);
		return NextResponse.json({ message: 'Failed to update reaction' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}
