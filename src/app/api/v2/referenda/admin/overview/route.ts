// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { toReferendumDetailDto, toReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { isAdminActor, requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';

/**
 * GET /api/v2/referenda/admin/overview (plan P2, operations panel).
 *
 * Admin-only trusted endpoint: lifecycle status counts via count aggregation
 * plus the most recent referenda with their aggregate stats joined. Non-admin
 * and anonymous callers receive 403/401 respectively.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ message: 'Operations panel is not available in chain mode.' }, { status: 403 });
	}

	try {
		const actor = await requireVerifiedActor(req);
		const admin = await isAdminActor(actor.uid);
		if (!admin) {
			return NextResponse.json({ message: 'Only administrators can view the operations panel.' }, { status: 403 });
		}

		const overview = await new ReferendumReadService().getAdminOverview();
		return NextResponse.json({
			statusCounts: overview.statusCounts,
			totalReferenda: overview.totalReferenda,
			recent: overview.recent.map(({ referendum, stats }) => ({
				referendum: toReferendumDetailDto(referendum),
				stats: stats ? toReferendumStatsDto(stats) : null
			}))
		});
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
