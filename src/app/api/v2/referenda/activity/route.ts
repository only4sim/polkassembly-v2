// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumTrustedService } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { referendaErrorResponse, publicCache } from '@/app/api/_api-utils/referendaErrors';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * GET /api/v2/referenda/activity?limit=&page=
 * Public activity feed — reverse chronological lifecycle events.
 * No auth required; events are privacy-safe (no UID/balance).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ items: [], totalCount: 0, page: 1, pageSize: 0 });
	}
	const sp = req.nextUrl.searchParams;
	const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
	const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);

	try {
		const service = new ReferendumTrustedService();
		const { items, totalCount } = await service.listActivityEvents({ limit, page });
		return publicCache(NextResponse.json({ items, totalCount, page, pageSize: limit }), 60);
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
