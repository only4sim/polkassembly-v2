// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { toReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';

function parseIndex(value: string): number | null {
	if (!/^\d+$/.test(value)) return null;
	const n = Number(value);
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * GET /api/v2/referenda/{index}/votes
 * Recent vote history (point-weighted) for the detail page.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ items: [], totalCount: 0 });
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', 'Referendum not found.'));
	}
	const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));

	try {
		const service = new ReferendumReadService();
		const referendum = await service.getByIndex(index);
		if (!referendum) {
			return referendaErrorResponse(new ReferendaServiceError('not-found', 'Referendum not found.'));
		}
		const votes = await service.listVotes(index, limit);
		return NextResponse.json({ items: votes.map(toReferendumVoteDto), totalCount: votes.length });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
