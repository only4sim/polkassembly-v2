// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoPostService } from '@/app/api/_api-services/demoPostService';

/**
 * GET /api/v2/posts/by-author/[uid]
 * Returns all discussion posts authored by the specified user UID.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }): Promise<NextResponse> {
	const { uid } = await params;
	if (!uid) {
		return NextResponse.json({ message: 'User ID is required' }, { status: StatusCodes.BAD_REQUEST });
	}

	try {
		const posts = await DemoPostService.listPostsByAuthor(uid);
		return NextResponse.json({ posts });
	} catch (err) {
		console.error(`[GET /api/v2/posts/by-author/${uid}] Failed to fetch posts:`, err);
		return NextResponse.json({ message: 'Failed to fetch posts' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}
