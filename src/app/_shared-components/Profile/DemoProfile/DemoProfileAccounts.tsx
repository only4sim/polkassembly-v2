// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useTranslations } from 'next-intl';
import { Separator } from '@/app/_shared-components/Separator';
import { User } from '@/domain/entities/User';
import classes from '../Accounts/Accounts.module.scss';

interface DemoProfileAccountsProps {
	user: Pick<User, 'uid' | 'email' | 'displayName' | 'createdAt'>;
}

function DemoProfileAccounts({ user }: DemoProfileAccountsProps) {
	const t = useTranslations('Profile');

	const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
		day: 'numeric'
	});

	const firstLetter = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

	return (
		<div className={classes.accountsWrapper}>
			<div className={classes.accountsHeader}>
				<p className={classes.accountsHeaderText}>{t('accounts')}</p>
			</div>
			<Separator className='mb-4' />
			<div className={classes.accountsList}>
				{/* Firebase account card — styled to match blockchain Account card layout */}
				<div className='flex items-start gap-x-4 rounded-xl border border-border_grey p-4'>
					{/* First-letter avatar replaces Polkadot Identicon */}
					<div className='flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-text_pink text-2xl font-bold text-white'>{firstLetter}</div>

					<div className='flex flex-col gap-y-2'>
						<p className='text-lg font-semibold text-text_primary lg:text-xl'>{user.displayName || user.email || 'User'}</p>
						{user.email && <p className='text-sm text-wallet_btn_text'>{user.email}</p>}

						{/* Balance-row equivalent — shows join date */}
						<div className='flex items-center gap-x-2'>
							<div className='flex flex-col items-center gap-y-1'>
								<p className='text-xs text-wallet_btn_text'>Member since</p>
								<p className='font-semibold text-text_primary'>{joinDate}</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default DemoProfileAccounts;
