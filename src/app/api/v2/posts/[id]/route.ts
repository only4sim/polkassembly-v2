// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoPostService } from '@/app/api/_api-services/demoPostService';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';

const unauthorizedMessage = 'Unauthorized';
const postIdRequiredMessage = 'Post ID is required';

type UpdatePostBody = {
	title?: string;
	content?: string;
	topic?: string;
	tags?: string[];
	allowedCommentor?: string;
};

/**
 * GET /api/v2/posts/[id]
 * Returns the details of a single discussion post by its Firestore document ID.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id } = await params;
	if (!id) {
		return NextResponse.json({ message: postIdRequiredMessage }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		const post = await DemoPostService.getPostById(id);
		if (!post) {
			return NextResponse.json({ message: 'Post not found' }, { status: StatusCodes.NOT_FOUND });
		}
		return NextResponse.json({ post });
	} catch (err) {
		console.error(`[GET /api/v2/posts/${id}] Failed to fetch post:`, err);
		return NextResponse.json({ message: 'Failed to fetch post' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}

/**
 * PATCH /api/v2/posts/[id]
 * Updates a discussion post. Caller must own the post.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id } = await params;
	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) {
		return NextResponse.json({ message: unauthorizedMessage }, { status: StatusCodes.UNAUTHORIZED });
	}

	const decoded = await DemoAuthService.verifyIdToken(idToken);
	if (!decoded) {
		return NextResponse.json({ message: unauthorizedMessage }, { status: StatusCodes.UNAUTHORIZED });
	}

	const body = (await req.json().catch(() => ({}))) as UpdatePostBody;

	if (!id) {
		return NextResponse.json({ message: postIdRequiredMessage }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		const post = await DemoPostService.updatePost(id, decoded.uid, body);
		return NextResponse.json({ post });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to update post';
		const status = message.includes('authorized') ? StatusCodes.FORBIDDEN : StatusCodes.BAD_REQUEST;
		return NextResponse.json({ message }, { status });
	}
}

/**
 * DELETE /api/v2/posts/[id]
 * Deletes a discussion post. Caller must own the post.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id } = await params;
	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) {
		return NextResponse.json({ message: unauthorizedMessage }, { status: StatusCodes.UNAUTHORIZED });
	}

	const decoded = await DemoAuthService.verifyIdToken(idToken);
	if (!decoded) {
		return NextResponse.json({ message: unauthorizedMessage }, { status: StatusCodes.UNAUTHORIZED });
	}

	if (!id) {
		return NextResponse.json({ message: postIdRequiredMessage }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		await DemoPostService.deletePost(id, decoded.uid);
		return NextResponse.json({ message: 'Post deleted' });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete post';
		const status = message.includes('authorized') ? StatusCodes.FORBIDDEN : StatusCodes.BAD_REQUEST;
		return NextResponse.json({ message }, { status });
	}
}
