// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import React from 'react';
import Link from 'next/link';
import { FaRegClock } from '@react-icons/all-files/fa/FaRegClock';
import { dayjs } from '@/_shared/_utils/dayjsInit';

/**
 * Unified row shape for the DemoOS Latest Activity card. Covers both
 * Firestore discussion posts and points-based referenda so the "All" tab
 * can render a single, time-sorted feed.
 */
export interface DemoActivityItem {
	id: string;
	title: string;
	subtitle?: string;
	createdAt: Date;
	href: string;
}

interface DemoActivityListProps {
	items: DemoActivityItem[];
	isLoading?: boolean;
	noActivityText?: string;
	viewAllUrl?: string;
}

/**
 * DemoOS activity rows for the homepage Latest Activity card.
 *
 * Renders Firestore discussion posts and/or points-based referenda. Post
 * rows link to the Discussions page (`/discussions/{id}`) and referendum
 * rows link to `/referenda/{index}` — never the on-chain `/post/{index}`
 * route, and no chain-only fields (DOT metrics, addresses).
 */
function DemoActivityList({ items, isLoading = false, noActivityText = 'No activity data found', viewAllUrl = '/discussions' }: DemoActivityListProps) {
	return (
		<div className='relative flex flex-col'>
			{isLoading && <div className='absolute inset-0 z-10 flex items-center justify-center bg-bg_modal/60 text-sm text-wallet_btn_text'>Loading…</div>}
			<div className='override_scrollbar flex max-h-[400px] flex-col overflow-y-auto'>
				{items.length > 0 ? (
					items.map((item) => (
						<Link
							key={item.id}
							href={item.href}
							className='block w-full border-b border-border_grey px-2 py-3 last:border-0 hover:bg-bg_modal/80'
						>
							<div className='flex items-start justify-between gap-2'>
								<p className='line-clamp-1 text-sm font-medium text-text_primary'>{item.title}</p>
								<span className='flex shrink-0 items-center gap-1 text-xs text-wallet_btn_text'>
									<FaRegClock className='text-sm' />
									{dayjs(item.createdAt).fromNow()}
								</span>
							</div>
							{item.subtitle && <p className='mt-0.5 line-clamp-1 text-xs text-btn_secondary_text'>{item.subtitle}</p>}
						</Link>
					))
				) : (
					<div className='py-8 text-center text-sm text-wallet_btn_text'>{noActivityText}</div>
				)}
			</div>
			<div className='mt-4 flex justify-center'>
				<Link
					href={viewAllUrl}
					className='text-sm font-medium text-text_pink hover:underline'
				>
					View all
				</Link>
			</div>
		</div>
	);
}

export default DemoActivityList;
