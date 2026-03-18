// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { EProposalStatus, EProposalType } from '@/_shared/types';
import ListingPage from '@ui/ListingComponent/ListingPage/ListingPage';
import { NextApiClientService } from '@/app/_client-services/next_api_client_service';
import { ERROR_CODES, ERROR_MESSAGES } from '@/_shared/_constants/errorLiterals';
import { ClientError } from '@/app/_client-utils/clientError';
import { z } from 'zod';
import { Metadata } from 'next';
import { OPENGRAPH_METADATA } from '@/_shared/_constants/opengraphMetadata';
import { getNetworkFromHeaders } from '@/app/api/_api-utils/getNetworkFromHeaders';
import { getGeneratedContentMetadata } from '@/_shared/_utils/generateContentMetadata';
import DemoPostList from '@/app/_shared-components/DemoPost/DemoPostList';
import Link from 'next/link';

export async function generateMetadata(): Promise<Metadata> {
	if (process.env.ENABLE_BLOCKCHAIN !== 'true') {
		return { title: 'Discussions' };
	}
	const network = await getNetworkFromHeaders();
	const { title } = OPENGRAPH_METADATA;

	return getGeneratedContentMetadata({
		title: `${title} - Discussions`,
		description: 'Explore all Discussions on Polkassembly',
		url: `https://${network}.polkassembly.io/discussions`,
		imageAlt: 'Polkassembly Discussions',
		network
	});
}

const zodQuerySchema = z.object({
	page: z.coerce.number().min(1).optional().default(1),
	status: z.preprocess((val) => (Array.isArray(val) ? val : typeof val === 'string' ? [val] : undefined), z.array(z.nativeEnum(EProposalStatus))).optional()
});

async function DiscussionsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
	// DemoOS mode: fetch posts from Firestore `posts` collection via API
	if (process.env.ENABLE_BLOCKCHAIN !== 'true') {
		return (
			<div>
				<div className='bg-section_dark_overlay'>
					<div className='mx-auto max-w-7xl bg-section_dark_overlay px-4 pt-8 lg:px-16'>
						<div className='flex items-center justify-between gap-5 md:gap-0'>
							<div>
								<h1 className='text-lg font-bold text-btn_secondary_text lg:text-2xl'>Discussions</h1>
								<p className='pt-2 text-sm text-gray-600'>Explore all Discussions on this forum</p>
							</div>
							<Link
								href='/create/discussion'
								className='hidden items-center gap-1.5 rounded-full bg-btn_primary_background px-3 py-1.5 text-white shadow lg:flex lg:px-6 lg:py-2'
							>
								<span className='text-xl'>+</span>
								<span className='whitespace-nowrap text-sm'>Create Post</span>
							</Link>
						</div>
						<div className='mt-5 flex justify-between'>
							<div className='flex gap-x-2'>
								<button
									type='button'
									className='border-b-2 border-text_pink px-4 py-3 text-sm font-semibold uppercase text-text_pink'
								>
									Polkassembly
								</button>
							</div>
						</div>
					</div>
				</div>
				<div className='mx-auto min-h-[600px] max-w-7xl bg-page_background px-4 py-5 lg:px-16'>
					<div className='overflow-hidden rounded-xl border border-border_grey bg-bg_modal shadow-sm'>
						<DemoPostList />
					</div>
				</div>
			</div>
		);
	}

	const searchParamsValue = await searchParams;
	const { page, status: statuses } = zodQuerySchema.parse(searchParamsValue);

	const { data, error } = await NextApiClientService.fetchListingData({ proposalType: EProposalType.DISCUSSION, page, statuses });

	if (error || !data) {
		throw new ClientError(ERROR_CODES.CLIENT_ERROR, error?.message || ERROR_MESSAGES[ERROR_CODES.CLIENT_ERROR]);
	}

	return (
		<div>
			<ListingPage
				proposalType={EProposalType.DISCUSSION}
				initialData={data || { items: [], totalCount: 0 }}
				statuses={statuses || []}
				page={page}
			/>
		</div>
	);
}

export default DiscussionsPage;
