// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendaServiceError, ReferendumTrustedService } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { isAdminActor, requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';

/**
 * POST /api/v2/referenda/{index}/admin/finalize
 *
 * Admin-only immediate finalization of an EXPIRED Deciding referendum, using
 * the same exact outcome algorithm as the scheduled lifecycle processor
 * (useful in local dev where the scheduler does not run, and for manual ops).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return referendaErrorResponse(new ReferendaServiceError('forbidden', 'Lifecycle is handled by the chain flow when blockchain is enabled.'));
	}
	const { index: raw } = await params;
	const index = /^\d+$/.test(raw) ? Number(raw) : null;
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', 'Referendum not found.'));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const admin = await isAdminActor(actor.uid);
		if (!admin) {
			return NextResponse.json({ message: 'Only administrators can finalize.' }, { status: 403 });
		}
		const service = new ReferendumTrustedService();
		const result = await service.adminFinalize(index, admin);
		return NextResponse.json({ finalized: true, status: result.status });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
