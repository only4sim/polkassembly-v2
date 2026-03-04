// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useTranslations } from 'next-intl';
import { Separator } from '@/app/_shared-components/Separator';
import { User } from '@/domain/entities/User';
import classes from '../Settings/Settings.module.scss';

interface DemoProfileAccountsProps {
	user: Pick<User, 'uid' | 'email' | 'createdAt'>;
}

function DemoProfileAccounts({ user }: DemoProfileAccountsProps) {
	const t = useTranslations('Profile');

	const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
		day: 'numeric'
	});

	return (
		<div className={classes.accountsWrapper}>
			<div className={classes.accountsHeader}>
				<p className={classes.accountsHeaderText}>{t('accounts')}</p>
			</div>
			<Separator className='mb-4' />
			<div className={classes.settingsContent}>
				<div className='flex flex-col gap-y-3 rounded-2xl border border-border_grey p-6'>
					<p className='text-sm font-semibold text-text_primary'>Firebase Account</p>
					<Separator />
					<div className='flex flex-col gap-y-4'>
						<div>
							<p className='mb-1 text-xs text-wallet_btn_text'>Account ID</p>
							<p className='break-all font-mono text-sm text-text_primary'>{user.uid}</p>
						</div>
						{user.email && (
							<div>
								<p className='mb-1 text-xs text-wallet_btn_text'>{t('Settings.email')}</p>
								<p className='text-sm text-text_primary'>{user.email}</p>
							</div>
						)}
						<div>
							<p className='mb-1 text-xs text-wallet_btn_text'>Member Since</p>
							<p className='text-sm text-text_primary'>{joinDate}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default DemoProfileAccounts;
