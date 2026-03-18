// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoPostService } from '@/app/api/_api-services/demoPostService';

/**
 * GET /api/v2/posts/[id]
 * Returns the details of a single discussion post by its Firestore document ID.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id } = await params;
	if (!id) {
		return NextResponse.json({ message: 'Post ID is required' }, { status: StatusCodes.BAD_REQUEST });
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
