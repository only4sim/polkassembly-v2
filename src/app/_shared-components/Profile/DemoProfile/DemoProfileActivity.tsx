// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import noData from '@assets/activityfeed/gifs/noactivity.gif';
import { Separator } from '@/app/_shared-components/Separator';

// Activity in DemoOS shows on-chain voting activity, which requires
// ENABLE_BLOCKCHAIN=true. In DemoOS mode this tab mirrors the Votes empty state.

function DemoProfileActivity() {
	const t = useTranslations('Profile');

	return (
		<div className='flex w-full flex-col gap-y-4 rounded-[20px] border-[0.6px] border-border_grey bg-bg_modal px-6 py-4 pb-6 shadow-lg'>
			<header className='flex items-center justify-between'>
				<h2 className='text-2xl font-bold'>{t('Votes.votes')}</h2>
			</header>
			<Separator />
			<div
				className='mt-0 flex w-full flex-col items-center justify-center'
				role='status'
			>
				<Image
					src={noData}
					alt='No votes data available'
					width={300}
					height={300}
					priority
				/>
				<p className='mb-2 mt-0 text-text_secondary'>{t('Votes.noData')}</p>
			</div>
		</div>
	);
}

export default DemoProfileActivity;
