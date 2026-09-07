// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ReferendumSummaryDto } from '@/domain/dtos/ReferendaDtos';
import DemoReferendaCard from '@/app/_shared-components/DemoReferenda/DemoReferendaCard';
import DemoCreateReferendaDialog from '@/app/_shared-components/DemoReferenda/DemoCreateReferendaDialog';
import { Button } from '@/app/_shared-components/Button';

function DemoReferendaPage() {
	const t = useTranslations();
	const [items, setItems] = useState<ReferendumSummaryDto[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [createOpen, setCreateOpen] = useState(false);

	const pageSize = 10;

	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/v2/referenda?page=${page}&pageSize=${pageSize}`);
			if (!res.ok) throw new Error('Failed to fetch');
			const data = await res.json();
			setItems(data.items || []);
			setTotalCount(data.totalCount || 0);
		} catch {
			setItems([]);
		} finally {
			setLoading(false);
		}
	}, [page]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const totalPages = Math.ceil(totalCount / pageSize);

	return (
		<div className='container mx-auto px-4 py-6'>
			<div className='mb-6 flex items-center justify-between'>
				<h1 className='text-2xl font-bold text-text_primary'>
					{t('ListingPage.Referenda')} ({totalCount})
				</h1>
				<Button onClick={() => setCreateOpen(true)}>+ Create Referendum</Button>
			</div>

			{loading && items.length === 0 ? (
				<div className='flex h-40 items-center justify-center'>
					<span className='text-sm text-wallet_btn_text'>Loading...</span>
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

			{totalPages > 1 && (
				<div className='mt-6 flex items-center justify-center gap-2'>
					<Button
						variant='ghost'
						size='sm'
						disabled={page <= 1}
						onClick={() => setPage((p) => Math.max(1, p - 1))}
					>
						Previous
					</Button>
					<span className='text-sm text-wallet_btn_text'>
						Page {page} of {totalPages}
					</span>
					<Button
						variant='ghost'
						size='sm'
						disabled={page >= totalPages}
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
					>
						Next
					</Button>
				</div>
			)}

			{createOpen && (
				<DemoCreateReferendaDialog
					onClose={() => setCreateOpen(false)}
					onCreated={() => {
						setCreateOpen(false);
						setPage(1);
					}}
				/>
			)}
		</div>
	);
}

export default DemoReferendaPage;
