// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendumTrustedService, ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { requireVerifiedActor } from '@/app/api/_api-utils/referendaAuth';
import { toReferendumStatsDto, toReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { ReferendumDecision } from '@/domain/entities/Referendum';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';

const NOT_FOUND_MESSAGE = 'Referendum not found.';

function parseIndex(value: string): number | null {
	if (!/^\d+$/.test(value)) return null;
	const n = Number(value);
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * GET /api/v2/referenda/{index}/votes/me
 * Frozen shape (PR-1): `{ vote: ReferendumVoteDto | null }`
 * Includes audit fields (uid, balanceAtVote) — owner-only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ vote: null });
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const service = new ReferendumReadService();
		const referendum = await service.getByIndex(index);
		if (!referendum) {
			return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
		}
		const vote = await service.getVote(index, actor.uid);
		return NextResponse.json({ vote: vote ? toReferendumVoteDto(vote) : null });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}

/**
 * PUT /api/v2/referenda/{index}/votes/me
 * Frozen shape (PR-1): `{ vote: ReferendumVoteDto, stats: ReferendumStatsDto }`
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ message: 'Voting is handled by the chain flow when blockchain is enabled.' });
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const body = (await req.json().catch(() => ({}))) as { decision?: unknown; pointsUsed?: unknown };

		const service = new ReferendumTrustedService();
		const { vote, stats } = await service.upsertVote(index, actor, {
			decision: body.decision as ReferendumDecision,
			pointsUsed: body.pointsUsed as number
		});
		return NextResponse.json({ vote: toReferendumVoteDto(vote), stats: toReferendumStatsDto(stats) });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}

/**
 * DELETE /api/v2/referenda/{index}/votes/me
 * Frozen shape (PR-1): `{ removed: true, stats: ReferendumStatsDto }`
 * Idempotent: removing a non-existent vote still returns `{ removed: true }`.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return NextResponse.json({ message: 'Voting is handled by the chain flow when blockchain is enabled.' });
	}
	const { index: raw } = await params;
	const index = parseIndex(raw);
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
	}

	try {
		const actor = await requireVerifiedActor(req);
		const service = new ReferendumTrustedService();
		const stats = await service.removeVote(index, actor);
		return NextResponse.json({ removed: true, stats: toReferendumStatsDto(stats) });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
