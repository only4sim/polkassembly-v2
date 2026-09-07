// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendumTrustedService, ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { toReferendumSummaryDto, type ReferendaListDto } from '@/domain/dtos/ReferendaDtos';
import { ReferendumStatus } from '@/domain/entities/Referendum';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';

const MAX_PAGE_SIZE = 50;

/**
 * GET /api/v2/referenda?page=&pageSize=&status=
 * List points-based referenda (DemoOS) in the existing listing visual language.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
	// In chain mode the original chain Referenda APIs serve this path; this
	// DemoOS endpoint is only reachable when blockchain integration is disabled.
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ items: [], totalCount: 0, page: 1, pageSize: 0 });
	}

	const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
	const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 10));
	const rawStatus = req.nextUrl.searchParams.get('status');
	const statuses = rawStatus
		? rawStatus
				.split(',')
				.map((s) => s.trim())
				.filter((s) => (Object.values(ReferendumStatus) as string[]).includes(s))
		: undefined;

	try {
		const service = new ReferendumReadService();
		const { items, totalCount } = await service.list({ page, pageSize, statuses });
		const dto: ReferendaListDto = {
			items: items.map(toReferendumSummaryDto),
			totalCount,
			page,
			pageSize
		};
		return NextResponse.json(dto);
	} catch (err) {
		return referendaErrorResponse(err);
	}
}

/**
 * POST /api/v2/referenda
 * Trusted creation with a server-assigned author and transactionally allocated
 * numeric index. The DemoOS create flow calls this — never the wallet/extrinsic path.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return referendaErrorResponse(new ReferendaServiceError('forbidden', 'Creation is handled by the chain flow when blockchain is enabled.'));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

		const service = new ReferendumTrustedService();
		const created = await service.createReferendum(actor, {
			title: body.title as string,
			content: body.content as string,
			origin: body.origin as string,
			tags: body.tags as string[] | undefined,
			votingStartsAt: body.votingStartsAt as string,
			votingEndsAt: body.votingEndsAt as string,
			approvalThresholdBps: body.approvalThresholdBps as number,
			minimumTurnoutPoints: body.minimumTurnoutPoints as number
		});

		// If the voting window has already opened, transition to Deciding immediately.
		if (new Date(created.votingStartsAt).getTime() <= Date.now()) {
			await service.openForVoting(created.index);
		}

		return NextResponse.json({ message: 'Referendum created', data: toReferendumSummaryDto(created) }, { status: StatusCodes.CREATED });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
