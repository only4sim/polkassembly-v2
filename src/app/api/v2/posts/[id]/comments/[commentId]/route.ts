// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoCommentService } from '@/app/api/_api-services/demoCommentService';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';

const COMMENT_NOT_FOUND_MESSAGE = 'Comment not found';

/**
 * PATCH /api/v2/posts/[id]/comments/[commentId]
 * Update the content of a comment. Caller must own the comment.
 *
 * Body: { content: string }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }): Promise<NextResponse> {
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

	const body = (await req.json().catch(() => ({}))) as { content?: string };
	const { content } = body;

	if (!content || typeof content !== 'string' || !content.trim()) {
		return NextResponse.json({ message: 'Content is required' }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		const comment = await DemoCommentService.updateComment(postId, commentId, uid, content);
		return NextResponse.json({ comment });
	} catch (err) {
		const { message } = err as Error;
		if (message === COMMENT_NOT_FOUND_MESSAGE) {
			return NextResponse.json({ message: COMMENT_NOT_FOUND_MESSAGE }, { status: StatusCodes.NOT_FOUND });
		}
		if (message === 'Forbidden') {
			return NextResponse.json({ message: 'Forbidden' }, { status: StatusCodes.FORBIDDEN });
		}
		console.error(`[PATCH /api/v2/posts/${postId}/comments/${commentId}] Failed:`, err);
		return NextResponse.json({ message: 'Failed to update comment' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}

/**
 * DELETE /api/v2/posts/[id]/comments/[commentId]
 * Delete a comment. Caller must own the comment.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }): Promise<NextResponse> {
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

	try {
		await DemoCommentService.deleteComment(postId, commentId, uid);
		return NextResponse.json({ message: 'Comment deleted' });
	} catch (err) {
		const { message } = err as Error;
		if (message === COMMENT_NOT_FOUND_MESSAGE) {
			return NextResponse.json({ message: COMMENT_NOT_FOUND_MESSAGE }, { status: StatusCodes.NOT_FOUND });
		}
		if (message === 'Forbidden') {
			return NextResponse.json({ message: 'Forbidden' }, { status: StatusCodes.FORBIDDEN });
		}
		console.error(`[DELETE /api/v2/posts/${postId}/comments/${commentId}] Failed:`, err);
		return NextResponse.json({ message: 'Failed to delete comment' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}
