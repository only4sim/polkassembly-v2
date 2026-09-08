// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendaServiceError, ReferendumTrustedService } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { isAdminActor, requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';

/**
 * DELETE /api/v2/referenda/{index}/comments/{commentId} (plan PR-7).
 * Author-or-admin deletion, enforced again inside the trusted service.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ index: string; commentId: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return referendaErrorResponse(new ReferendaServiceError('forbidden', 'Comments are handled by the chain flow when blockchain is enabled.'));
	}
	const { index: raw, commentId } = await params;
	const index = /^\d+$/.test(raw) ? Number(raw) : null;
	if (index === null || !commentId) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', 'Comment not found.'));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const admin = await isAdminActor(actor.uid);
		const service = new ReferendumTrustedService();
		await service.deleteComment(index, commentId, actor.uid, admin);
		return NextResponse.json({ deleted: true });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
