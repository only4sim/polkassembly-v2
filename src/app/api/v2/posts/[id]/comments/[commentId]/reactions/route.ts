// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoCommentService } from '@/app/api/_api-services/demoCommentService';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';

/**
 * POST /api/v2/posts/[id]/comments/[commentId]/reactions
 * Toggle a like or dislike reaction on a comment. Requires Firebase auth.
 *
 * Body: { reaction: 'like' | 'dislike' }
 *
 * Behaviour:
 *  - If the caller already has the same reaction → it is removed (toggle off).
 *  - If the caller has a different reaction → it is replaced.
 *  - Otherwise the reaction is added.
 *
 * Returns the updated reactions map: `{ reactions: Record<string, 'like' | 'dislike'> }`
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }): Promise<NextResponse> {
	const { id: postId, commentId } = await params;

	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const decoded = await DemoAuthService.verifyIdToken(idToken);
	if (!decoded) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const { uid } = decoded;

	const body = (await req.json().catch(() => ({}))) as { reaction?: string };
	const { reaction } = body;

	if (reaction !== 'like' && reaction !== 'dislike') {
		return NextResponse.json({ message: 'reaction must be "like" or "dislike"' }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		const reactions = await DemoCommentService.toggleReaction(postId, commentId, uid, reaction);
		return NextResponse.json({ reactions });
	} catch (err) {
		const { message } = err as Error;
		if (message === 'Comment not found') {
			return NextResponse.json({ message: 'Comment not found' }, { status: StatusCodes.NOT_FOUND });
		}
		console.error(`[POST /api/v2/posts/${postId}/comments/${commentId}/reactions] Failed:`, err);
		return NextResponse.json({ message: 'Failed to update reaction' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}
