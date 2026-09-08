// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReferendumSummaryDto } from '@/domain/dtos/ReferendaDtos';
import DemoReferendaCard from '@/app/_shared-components/DemoReferenda/DemoReferendaCard';
import DemoCreateReferendaDialog from '@/app/_shared-components/DemoReferenda/DemoCreateReferendaDialog';
import { Button } from '@/app/_shared-components/Button';

interface ListPayload {
	items: ReferendumSummaryDto[];
	totalCount: number;
	page: number;
	pageSize: number;
}

interface Props {
	/** Server-rendered initial list; null means the server load FAILED (not empty). */
	initialList: ListPayload | null;
	initialPage: number;
	initialStatuses: string[];
}

const STATUS_FILTERS = ['Submitted', 'Deciding', 'Confirmed', 'Rejected'] as const;

function hrefFor(page: number, statuses: string[]): string {
	const params = new URLSearchParams();
	if (page > 1) params.set('page', String(page));
	if (statuses.length > 0) params.set('status', statuses.join(','));
	const qs = params.toString();
	return qs ? `/referenda?${qs}` : '/referenda';
}

function DemoReferendaPage({ initialList, initialPage, initialStatuses }: Props) {
	const t = useTranslations();
	const router = useRouter();
	const [createOpen, setCreateOpen] = useState(false);

	const items = initialList?.items ?? [];
	const totalCount = initialList?.totalCount ?? 0;
	const pageSize = initialList?.pageSize ?? 10;
	const page = initialList?.page ?? initialPage;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	// null payload = server load failure — distinct from a genuine empty list.
	const isServerError = initialList === null;

	return (
		<div className='container mx-auto px-4 py-6'>
			<div className='mb-4 flex items-center justify-between'>
				<h1 className='text-2xl font-bold text-text_primary'>
					{t('ListingPage.Referenda')} ({totalCount})
				</h1>
				<Button onClick={() => setCreateOpen(true)}>+ Create Referendum</Button>
			</div>

			{/* Status filter — URL-driven so each view is server-rendered */}
			<div className='mb-4 flex flex-wrap items-center gap-2'>
				<Link
					href={hrefFor(1, [])}
					className={`rounded-full border px-3 py-1 text-xs font-medium ${initialStatuses.length === 0 ? 'border-text_pink bg-text_pink text-white' : 'border-border_grey text-wallet_btn_text'}`}
				>
					All
				</Link>
				{STATUS_FILTERS.map((status) => {
					const active = initialStatuses.length === 1 && initialStatuses[0] === status;
					return (
						<Link
							key={status}
							href={hrefFor(1, [status])}
							className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${active ? 'border-text_pink bg-text_pink text-white' : 'border-border_grey text-wallet_btn_text'}`}
						>
							{status}
						</Link>
					);
				})}
			</div>

			{isServerError ? (
				<div className='flex h-40 flex-col items-center justify-center gap-3'>
					<span className='text-sm text-failure'>Unable to load referenda. Please try again.</span>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => router.refresh()}
					>
						Retry
					</Button>
				</div>
			) : items.length === 0 ? (
				<div className='flex h-40 items-center justify-center'>
					<span className='text-sm text-wallet_btn_text'>No referenda yet.</span>
				</div>
			) : (
				<div>
					{items.map((item, idx) => (
						<div
							key={item.index}
							className={idx % 2 === 0 ? 'bg-listing_card1' : 'bg-section_dark_overlay'}
						>
							<DemoReferendaCard data={item} />
						</div>
					))}
				</div>
			)}

			{!isServerError && totalPages > 1 && (
				<div className='mt-6 flex items-center justify-center gap-2'>
					{page > 1 ? (
						<Link
							href={hrefFor(page - 1, initialStatuses)}
							className='rounded-md px-3 py-1.5 text-sm text-wallet_btn_text hover:text-text_primary'
						>
							Previous
						</Link>
					) : (
						<span className='rounded-md px-3 py-1.5 text-sm text-grey_bg'>Previous</span>
					)}
					<span className='text-sm text-wallet_btn_text'>
						Page {page} of {totalPages}
					</span>
					{page < totalPages ? (
						<Link
							href={hrefFor(page + 1, initialStatuses)}
							className='rounded-md px-3 py-1.5 text-sm text-wallet_btn_text hover:text-text_primary'
						>
							Next
						</Link>
					) : (
						<span className='rounded-md px-3 py-1.5 text-sm text-grey_bg'>Next</span>
					)}
				</div>
			)}

			{createOpen && (
				<DemoCreateReferendaDialog
					onClose={() => setCreateOpen(false)}
					onCreated={() => {
						setCreateOpen(false);
						// Frozen contract (PR-5): refresh via the server provider so the
						// list (including page one) reflects the creation immediately.
						router.refresh();
					}}
				/>
			)}
		</div>
	);
}

export default DemoReferendaPage;
