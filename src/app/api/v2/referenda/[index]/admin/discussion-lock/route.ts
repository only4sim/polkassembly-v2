// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumTrustedService, ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { referendaErrorResponse, privateCache } from '@/app/api/_api-utils/referendaErrors';
import { requireVerifiedActor, isAdminActor } from '@/app/api/_api-utils/referendaAuth';

/**
 * PUT /api/v2/referenda/{index}/admin/discussion-lock
 * Admin-only: toggle discussion lock. Body: { locked: boolean }
 * Locking prevents new comments; does not affect voting or status.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return referendaErrorResponse(new ReferendaServiceError('forbidden', 'Not available in chain mode.'));
	}
	const { index: indexStr } = await params;
	const index = Number(indexStr);
	if (!Number.isSafeInteger(index) || index < 0) {
		return referendaErrorResponse(new ReferendaServiceError('invalid-argument', 'Invalid referendum index.'));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const admin = await isAdminActor(actor.uid);
		if (!admin) {
			return referendaErrorResponse(new ReferendaServiceError('forbidden', 'Only administrators can lock discussions.'));
		}
		const body = (await req.json().catch(() => ({}))) as { locked?: unknown };
		const locked = body.locked === true;

		const service = new ReferendumTrustedService();
		await service.setDiscussionLock(index, locked, actor, true);
		return privateCache(NextResponse.json({ success: true, locked }, { status: StatusCodes.OK }));
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
