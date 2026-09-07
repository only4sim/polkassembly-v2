// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendumTrustedService, ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { toReferendumDetailDto } from '@/domain/dtos/ReferendaDtos';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { isAdminActor, requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';

const NOT_FOUND_MESSAGE = 'Referendum not found.';

function parseIndex(value: string): number | null {
	if (!/^\d+$/.test(value)) return null;
	const n = Number(value);
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * GET /api/v2/referenda/{index}
 * Detail for a single points-based referendum (DemoOS).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json(null);
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
	}

	try {
		const service = new ReferendumReadService();
		const referendum = await service.getByIndex(index);
		if (!referendum) {
			return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
		}
		return NextResponse.json(toReferendumDetailDto(referendum));
	} catch (err) {
		return referendaErrorResponse(err);
	}
}

/**
 * DELETE /api/v2/referenda/{index}
 * Admin-only cancellation lifecycle transition.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return referendaErrorResponse(new ReferendaServiceError('forbidden', 'Lifecycle is handled by the chain flow when blockchain is enabled.'));
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const admin = await isAdminActor(actor.uid);
		const service = new ReferendumTrustedService();
		await service.cancelReferendum(index, actor.uid, admin);
		return NextResponse.json({ message: 'Referendum cancelled.' });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
