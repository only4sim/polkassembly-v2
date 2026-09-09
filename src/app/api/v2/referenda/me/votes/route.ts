// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { toReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';

/**
 * GET /api/v2/referenda/me/votes (plan PR-8, profile vote history).
 *
 * Trusted path: returns the VERIFIED caller's own votes across all referenda,
 * each joined with the referendum's public summary (index/title/status/window)
 * via one batched getAll. Own-vote audit fields (uid, balanceAtVote) are
 * included because the caller is the owner — never exposed on public routes.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ items: [], totalCount: 0, page: 1, pageSize: 0 });
	}

	try {
		const actor = await requireVerifiedActor(req);
		const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));
		const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);

		const service = new ReferendumReadService();
		const [votes, totalCount] = await Promise.all([service.listUserVotes(actor.uid, limit, page), service.countUserVotes(actor.uid)]);

		// One batched read for all referenced referenda (no N+1).
		const summaries = await service.getReferendaByIndexes(votes.map((entry) => entry.index));
		const items = votes.map((entry) => {
			const referendum = summaries.get(entry.index);
			return {
				vote: toReferendumVoteDto(entry.vote),
				referendum: referendum
					? {
							index: referendum.index,
							title: referendum.title,
							status: referendum.status,
							votingStartsAt: referendum.votingStartsAt,
							votingEndsAt: referendum.votingEndsAt
						}
					: null
			};
		});

		return NextResponse.json({ items, totalCount, page, pageSize: limit });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
