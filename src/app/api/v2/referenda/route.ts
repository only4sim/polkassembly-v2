// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendumTrustedService, ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { toReferendumDetailDto, toReferendumSummaryDto, type ReferendaListDto } from '@/domain/dtos/ReferendaDtos';
import { REFERENDA_ORIGINS, ReferendumStatus } from '@/domain/entities/Referendum';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;

const VALID_STATUSES = Object.values(ReferendumStatus) as string[];

/**
 * Frozen list query contract (PR-1):
 *  - `page` — positive integer (default 1);
 *  - `pageSize` — integer 1..MAX_PAGE_SIZE (default 10);
 *  - `status` — repeatable and/or comma-separated; must be a valid ReferendumStatus;
 *  - `origin` — single value from the domain origin allowlist;
 *  - invalid values return 400 and are never silently dropped.
 */
function parseListQuery(req: NextRequest): { errors: string[]; page: number; pageSize: number; statuses?: ReferendumStatus[]; origin?: string } {
	const sp = req.nextUrl.searchParams;
	const errors: string[] = [];

	const parsePositiveInt = (raw: string | null, name: string, fallback: number): number => {
		if (raw === null || raw === '') return fallback;
		if (!/^\d+$/.test(raw)) {
			errors.push(`${name} must be a positive integer.`);
			return fallback;
		}
		const n = Number(raw);
		if (!Number.isSafeInteger(n) || n < 1) {
			errors.push(`${name} must be a positive integer.`);
			return fallback;
		}
		return n;
	};

	const page = parsePositiveInt(sp.get('page'), 'page', 1);
	const pageSizeRaw = parsePositiveInt(sp.get('pageSize'), 'pageSize', DEFAULT_PAGE_SIZE);
	const pageSize = Math.min(MAX_PAGE_SIZE, pageSizeRaw);

	const statusParam = sp
		.getAll('status')
		.flatMap((s) => s.split(','))
		.map((s) => s.trim())
		.filter(Boolean);

	let statuses: ReferendumStatus[] | undefined;
	if (statusParam.length > 0) {
		const invalid = statusParam.filter((s) => !VALID_STATUSES.includes(s));
		if (invalid.length > 0) {
			errors.push(`status contains invalid values: ${invalid.join(', ')}`);
		} else {
			statuses = Array.from(new Set(statusParam)) as ReferendumStatus[];
		}
	}

	const originParam = sp.get('origin');
	let origin: string | undefined;
	if (originParam !== null && originParam !== '') {
		if (!(REFERENDA_ORIGINS as readonly string[]).includes(originParam)) {
			errors.push(`origin '${originParam}' is not supported.`);
		} else {
			origin = originParam;
		}
	}

	return { errors, page, pageSize, statuses, origin };
}

/**
 * GET /api/v2/referenda?page=&pageSize=&status=&origin=
 * List points-based referenda (DemoOS) in the existing listing visual language.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
	// In chain mode the original chain Referenda APIs serve this path; this
	// DemoOS endpoint is only reachable when blockchain integration is disabled.
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ items: [], totalCount: 0, page: 1, pageSize: 0 });
	}

	const { errors, page, pageSize, statuses, origin } = parseListQuery(req);
	if (errors.length > 0) {
		return referendaErrorResponse(new ReferendaServiceError('invalid-argument', errors.join(' ')));
	}

	try {
		const service = new ReferendumReadService();
		const { items, totalCount } = await service.list({ page, pageSize, statuses, origin });
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
 *
 * Frozen shape (PR-1): `{ referendum: ReferendumDetailDto }`
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

		// Frozen contract (PR-4): the initial status was decided inside the creation
		// transaction, so `created` already reflects the persisted state.
		return NextResponse.json({ referendum: toReferendumDetailDto(created) }, { status: StatusCodes.CREATED });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
