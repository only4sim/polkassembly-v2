// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { toReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';

function parseIndex(value: string): number | null {
	if (!/^\d+$/.test(value)) return null;
	const n = Number(value);
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * GET /api/v2/referenda/{index}/stats
 * Aggregate point-weighted results (also served to the realtime listener seed).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json(null);
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', 'Referendum not found.'));
	}

	try {
		const service = new ReferendumReadService();
		const referendum = await service.getByIndex(index);
		if (!referendum) {
			return referendaErrorResponse(new ReferendaServiceError('not-found', 'Referendum not found.'));
		}
		const stats = await service.getStats(index);
		return NextResponse.json(
			toReferendumStatsDto(stats ?? { ayePoints: 0, nayPoints: 0, abstainPoints: 0, ayeVoters: 0, nayVoters: 0, abstainVoters: 0, totalVoters: 0, updatedAt: '', schemaVersion: 1 })
		);
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
