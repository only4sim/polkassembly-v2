// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Metadata } from 'next';
import { type ReferendumSummaryDto } from '@/domain/dtos/ReferendaDtos';

export async function generateMetadata(): Promise<Metadata> {
	if (process.env.ENABLE_BLOCKCHAIN !== 'true') {
		return { title: 'Referenda – DemoOS' };
	}
	// Chain mode: load rich metadata with network URL from the chain page component
	const chainModule = await import('./ReferendaChainPage');
	if (typeof chainModule.generateMetadata === 'function') {
		return chainModule.generateMetadata();
	}
	return { title: 'Referenda' };
}

export default async function ReferendaPageProvider({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; origin?: string }> }) {
	if (process.env.ENABLE_BLOCKCHAIN === 'true') {
		const { default: ChainPage } = await import('./ReferendaChainPage');
		return <ChainPage searchParams={searchParams} />;
	}

	// DemoOS mode: resolve filters from the URL and load the initial list
	// server-side so the first paint has real data (plan PR-5).
	const sp = await searchParams;
	const page = Number.isSafeInteger(Number(sp.page)) && Number(sp.page) >= 1 ? Number(sp.page) : 1;
	const statuses = sp.status ? sp.status.split(',').filter((s) => s.length > 0) : [];
	const origin = sp.origin && sp.origin.length > 0 ? sp.origin : undefined;

	const { default: DemoReferendaPage } = await import('./DemoReferendaPage');

	let initialList: { items: ReferendumSummaryDto[]; totalCount: number; page: number; pageSize: number } | null = null;
	try {
		const { ReferendumReadService } = await import('@/app/api/_api-services/referenda/referendumReadService');
		const { toReferendumSummaryDto } = await import('@/domain/dtos/ReferendaDtos');
		const PAGE_SIZE = 10;
		const readService = new ReferendumReadService();
		const { items, totalCount } = await readService.list({ page, pageSize: PAGE_SIZE, statuses, origin });
		initialList = { items: items.map(toReferendumSummaryDto), totalCount, page, pageSize: PAGE_SIZE };
	} catch {
		// Server-side load failure: pass null so the client shell renders its
		// error state (distinct from a genuine empty list) with retry.
		initialList = null;
	}

	return (
		<DemoReferendaPage
			initialList={initialList}
			initialPage={page}
			initialStatuses={statuses}
		/>
	);
}
