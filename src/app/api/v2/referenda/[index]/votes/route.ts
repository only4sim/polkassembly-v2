// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { toPublicReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';

function parseIndex(value: string): number | null {
	if (!/^\d+$/.test(value)) return null;
	const n = Number(value);
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * GET /api/v2/referenda/{index}/votes
 * Public vote history.
 *
 * Frozen contract (PR-1):
 *  - items use the privacy-safe PublicReferendumVoteDto (no uid, no balanceAtVote,
 *    no email/role/pointsBalance);
 *  - `totalCount` is the real total, not the current page size.
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
	// Plan PR-7: pagination + decision filter; invalid filters are 400, not silently dropped.
	const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));
	const pageParam = req.nextUrl.searchParams.get('page');
	const page = pageParam === null ? 1 : Number(pageParam);
	if (!Number.isSafeInteger(page) || page < 1) {
		return referendaErrorResponse(new ReferendaServiceError('invalid-argument', 'page must be a positive integer.'));
	}
	const decisionParam = req.nextUrl.searchParams.get('decision');
	let decision: 'aye' | 'nay' | 'abstain' | undefined;
	if (decisionParam) {
		if (decisionParam !== 'aye' && decisionParam !== 'nay' && decisionParam !== 'abstain') {
			return referendaErrorResponse(new ReferendaServiceError('invalid-argument', 'decision must be aye, nay, or abstain.'));
		}
		decision = decisionParam;
	}

	try {
		const service = new ReferendumReadService();
		const referendum = await service.getByIndex(index);
		if (!referendum) {
			return referendaErrorResponse(new ReferendaServiceError('not-found', 'Referendum not found.'));
		}
		const [votes, totalCount] = await Promise.all([service.listVotes(index, { limit, page, decision }), service.countVotes(index, decision)]);
		return NextResponse.json({ items: votes.map(toPublicReferendumVoteDto), totalCount, page, pageSize: limit });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
