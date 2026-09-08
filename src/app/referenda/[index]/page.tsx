// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { type PublicReferendumVoteDto, type ReferendumCommentDto, type ReferendumDetailDto, type ReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
export async function generateMetadata(_params: { params: Promise<{ index: string }> }): Promise<Metadata> {
	if (process.env.ENABLE_BLOCKCHAIN !== 'true') {
		return { title: 'Referendum – DemoOS' };
	}
	// Chain mode: load rich metadata from the chain detail component
	const chainModule = await import('./ReferendaChainDetail');
	if (typeof chainModule.generateMetadata === 'function') {
		return chainModule.generateMetadata(_params);
	}
	return { title: 'Referendum' };
}

export default async function ReferendaDetailProvider({
	params,
	searchParams
}: {
	params: Promise<{ index: string }>;
	searchParams: Promise<{ created?: string; decision?: string }>;
}) {
	if (process.env.ENABLE_BLOCKCHAIN === 'true') {
		const { default: ChainDetail } = await import('./ReferendaChainDetail');
		return (
			<ChainDetail
				params={params}
				searchParams={searchParams}
			/>
		);
	}

	// DemoOS mode: strictly validate the index and server-render the detail,
	// initial stats and privacy-safe public history (plan PR-5).
	const { index: rawIndex } = await params;
	if (!/^\d+$/.test(rawIndex)) {
		notFound();
	}
	const index = Number(rawIndex);

	const { default: DemoReferendaDetail } = await import('./DemoReferendaDetail');

	let initialDetail: ReferendumDetailDto | null = null;
	let initialStats: ReferendumStatsDto | null = null;
	let initialHistory: { items: PublicReferendumVoteDto[]; totalCount: number } | null = null;
	let initialComments: { items: ReferendumCommentDto[]; totalCount: number } | null = null;
	let serverError = false;

	// Public history decision filter is URL-driven (plan PR-7).
	const sp = await searchParams;
	const decisionFilter = sp.decision === 'aye' || sp.decision === 'nay' || sp.decision === 'abstain' ? sp.decision : undefined;

	try {
		const { ReferendumReadService } = await import('@/app/api/_api-services/referenda/referendumReadService');
		const { toReferendumCommentDto, toReferendumDetailDto, toPublicReferendumVoteDto, toReferendumStatsDto } = await import('@/domain/dtos/ReferendaDtos');
		const readService = new ReferendumReadService();

		const referendum = await readService.getByIndex(index);
		if (!referendum) {
			notFound();
		}
		initialDetail = toReferendumDetailDto(referendum);

		const [stats, votes, voteCount, commentsPage] = await Promise.all([
			readService.getStats(index),
			readService.listVotes(index, { limit: 20, decision: decisionFilter }),
			readService.countVotes(index, decisionFilter),
			readService.listComments(index, 20, 1)
		]);
		initialStats = stats ? toReferendumStatsDto(stats) : null;
		initialHistory = { items: votes.map(toPublicReferendumVoteDto), totalCount: voteCount };
		initialComments = { items: commentsPage.items.map(toReferendumCommentDto), totalCount: commentsPage.totalCount };
	} catch {
		// Do not leak a fake referendum on infrastructure failure — surface the
		// error state in the client shell with a retry.
		serverError = true;
	}

	return (
		<DemoReferendaDetail
			index={index}
			initialDetail={initialDetail}
			initialStats={initialStats}
			initialHistory={initialHistory}
			initialComments={initialComments}
			decisionFilter={decisionFilter}
			serverError={serverError}
		/>
	);
}
