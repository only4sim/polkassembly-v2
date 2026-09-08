// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendaServiceError, ReferendumTrustedService } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { toReferendumCommentDto } from '@/domain/dtos/ReferendaDtos';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';

const NOT_FOUND_MESSAGE = 'Referendum not found.';

function parseIndex(value: string): number | null {
	if (!/^\d+$/.test(value)) return null;
	const n = Number(value);
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * GET /api/v2/referenda/{index}/comments — public, paginated (plan PR-7).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ items: [], totalCount: 0, page: 1, pageSize: 0 });
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
	}
	const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));
	const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);

	try {
		const service = new ReferendumReadService();
		const referendum = await service.getByIndex(index);
		if (!referendum) {
			return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
		}
		const { items, totalCount } = await service.listComments(index, limit, page);
		return NextResponse.json({ items: items.map(toReferendumCommentDto), totalCount, page, pageSize: limit });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}

/**
 * POST /api/v2/referenda/{index}/comments — trusted write (plan PR-7).
 * Identity from the verified token; content validated server-side.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return referendaErrorResponse(new ReferendaServiceError('forbidden', 'Comments are handled by the chain flow when blockchain is enabled.'));
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
		const service = new ReferendumTrustedService();
		const comment = await service.addComment(index, actor, body.content as string);
		return NextResponse.json({ comment: toReferendumCommentDto(comment) }, { status: StatusCodes.CREATED });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
