// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Metadata } from 'next';
import { OPENGRAPH_METADATA } from '@/_shared/_constants/opengraphMetadata';
import { getNetworkFromHeaders } from '@/app/api/_api-utils/getNetworkFromHeaders';
import { getGeneratedContentMetadata } from '@/_shared/_utils/generateContentMetadata';
import { type DemoPost } from '@/domain/entities/Post';
import { type ReferendumSummaryDto } from '@/domain/dtos/ReferendaDtos';
import type { Referendum } from '@/domain/entities/Referendum';
import Overview from './Components/Overview';
import { NextApiClientService } from '../_client-services/next_api_client_service';
import { getReferrerFromHeaders } from '../../_shared/_utils/getReferrerFromHeaders';
import KlaraAutoOpen from '../_shared-components/Klara/KlaraAutoOpen';

export async function generateMetadata(): Promise<Metadata> {
	const network = await getNetworkFromHeaders();
	const { title } = OPENGRAPH_METADATA;

	return getGeneratedContentMetadata({
		title,
		description: 'Polkassembly is a community-driven platform',
		url: `https://${network}.polkassembly.io`,
		imageAlt: 'Polkassembly',
		network
	});
}

async function OverviewPage() {
	const isBlockchainEnabled = process.env.ENABLE_BLOCKCHAIN === 'true';
	const { allTracks, treasuryStats } = isBlockchainEnabled
		? await NextApiClientService.fetchOverviewData()
		: { allTracks: { data: { items: [], totalCount: 0 }, error: null }, treasuryStats: { data: [], error: null } };

	// DemoOS mode: Latest Activity is backed by Firestore discussions AND
	// points-based referenda (votes), fetched in parallel.
	// Bounded to 3s each: when the Firestore emulator is not running the
	// Admin SDK gRPC dial can hang ~50s, which would stall the entire homepage.
	let demoDiscussions: DemoPost[] = [];
	let demoReferenda: ReferendumSummaryDto[] = [];
	if (!isBlockchainEnabled) {
		const [postsResult, referendaResult] = await Promise.allSettled([
			(async () => {
				const { DemoPostService } = await import('../api/_api-services/demoPostService');
				return Promise.race([
					DemoPostService.listPosts(10),
					new Promise<DemoPost[]>((resolve) => {
						setTimeout(() => resolve([]), 3000);
					})
				]);
			})(),
			(async () => {
				const { ReferendumReadService } = await import('../api/_api-services/referenda/referendumReadService');
				const { toReferendumSummaryDto } = await import('@/domain/dtos/ReferendaDtos');
				const readService = new ReferendumReadService();
				const referenda = await Promise.race<Referendum[]>([
					readService.listAll(),
					new Promise<Referendum[]>((resolve) => {
						setTimeout(() => resolve([]), 3000);
					})
				]);
				return referenda.map(toReferendumSummaryDto);
			})()
		]);
		demoDiscussions = postsResult.status === 'fulfilled' ? postsResult.value : [];
		demoReferenda = referendaResult.status === 'fulfilled' ? referendaResult.value : [];
	}
	const referer = await getReferrerFromHeaders();

	if (allTracks.error || !allTracks.data) {
		return (
			<div>
				<Overview
					allTracksData={{ items: [], totalCount: 0 }}
					treasuryStatsData={[]}
					isBlockchainEnabled={isBlockchainEnabled}
					demoDiscussions={demoDiscussions}
					demoReferenda={demoReferenda}
				/>
				<KlaraAutoOpen referer={referer} />
			</div>
		);
	}

	return (
		<div>
			<Overview
				allTracksData={allTracks.data}
				treasuryStatsData={treasuryStats.error ? [] : treasuryStats.data || []}
				isBlockchainEnabled={isBlockchainEnabled}
				demoDiscussions={demoDiscussions}
				demoReferenda={demoReferenda}
			/>
			<KlaraAutoOpen referer={referer} />
		</div>
	);
}
export default OverviewPage;
