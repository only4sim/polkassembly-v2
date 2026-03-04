// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useTranslations } from 'next-intl';
import { User } from '@/domain/entities/User';

interface DemoProfileOverviewProps {
	user: Pick<User, 'role' | 'pointsBalance' | 'createdAt'>;
}

function DemoProfileOverview({ user }: DemoProfileOverviewProps) {
	const t = useTranslations();

	const formattedDate = new Date(user.createdAt).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
		day: 'numeric'
	});

	return (
		<div className='flex flex-wrap gap-4'>
			<div className='flex min-w-[140px] flex-col gap-1 rounded-lg border border-border_grey bg-bg_modal p-4'>
				<p className='text-xs text-wallet_btn_text'>{t('Profile.overview')}</p>
				<p className='text-sm font-semibold capitalize text-text_primary'>{user.role}</p>
			</div>
			<div className='flex min-w-[140px] flex-col gap-1 rounded-lg border border-border_grey bg-bg_modal p-4'>
				<p className='text-xs text-wallet_btn_text'>Points Balance</p>
				<p className='text-sm font-semibold text-text_primary'>{user.pointsBalance}</p>
			</div>
			<div className='flex min-w-[140px] flex-col gap-1 rounded-lg border border-border_grey bg-bg_modal p-4'>
				<p className='text-xs text-wallet_btn_text'>Member Since</p>
				<p className='text-sm font-semibold text-text_primary'>{formattedDate}</p>
			</div>
		</div>
	);
}

export default DemoProfileOverview;
