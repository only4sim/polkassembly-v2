// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type ReferendumSummaryDto } from '@/domain/dtos/ReferendaDtos';
import { ReferendumStatus } from '@/domain/entities/Referendum';
import { fetchPointsReferendaList } from '@/app/_client-services/points_referenda_client_service';

/**
 * Public referenda lifecycle events for the Activity Feed sidebar (plan P2).
 *
 * Privacy-safe by construction: only PUBLIC, referendum-level events are shown
 * (created / voting opened / finalized / cancelled) — never a voter's identity,
 * decision or points (per-voter events require a separate product decision).
 * Data comes from the public list API; rendered only in DemoOS mode.
 */
function ReferendaActivityEvents() {
	const t = useTranslations('DemoReferenda');
	const [items, setItems] = useState<ReferendumSummaryDto[] | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetchPointsReferendaList({ page: 1, pageSize: 8 })
			.then((page) => {
				if (!cancelled) setItems(page.items);
			})
			.catch(() => {
				if (!cancelled) setItems([]);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (items === null || items.length === 0) return null;

	function statusEventKey(status: ReferendumStatus): string {
		switch (status) {
			case ReferendumStatus.Submitted:
				return 'created';
			case ReferendumStatus.Deciding:
				return 'opened';
			case ReferendumStatus.Confirmed:
			case ReferendumStatus.Rejected:
				return 'finalized';
			default:
				return 'cancelled';
		}
	}

	return (
		<div className='flex flex-col gap-3 rounded-xl border border-border_grey bg-bg_modal p-4 shadow-sm'>
			<div className='flex items-center justify-between'>
				<h3 className='text-sm font-semibold text-text_primary'>{t('feed.title')}</h3>
				<Link
					href='/referenda'
					className='text-xs text-text_pink hover:underline'
				>
					{t('feed.viewAll')}
				</Link>
			</div>
			<ul className='flex flex-col gap-2'>
				{items.map((item) => (
					<li key={item.index}>
						<Link
							href={`/referenda/${item.index}`}
							className='block rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-grey_bg'
						>
							<span className='font-medium capitalize text-text_primary'>{t(`feed.${statusEventKey(item.status as ReferendumStatus)}`)}</span>
							{' — '}
							<span className='text-wallet_btn_text'>
								#{item.index} {item.title}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

export default ReferendaActivityEvents;
