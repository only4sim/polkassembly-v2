// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useTranslations } from 'next-intl';

// Activity in DemoOS shows on-chain voting activity, which requires
// ENABLE_BLOCKCHAIN=true. In DemoOS mode this tab is a placeholder.

function DemoProfileActivity() {
	const t = useTranslations('Profile');

	return (
		<div className='flex flex-col items-center justify-center py-16 text-wallet_btn_text'>
			<p className='mb-2 text-lg font-medium text-text_primary'>{t('activity')}</p>
			<p className='text-sm'>{t('Votes.noData')}</p>
		</div>
	);
}

export default DemoProfileActivity;
