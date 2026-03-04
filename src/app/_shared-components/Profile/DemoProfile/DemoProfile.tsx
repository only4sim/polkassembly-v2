// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useState } from 'react';
import Image from 'next/image';
import ProfileRect from '@assets/profile/profile-rect.png';
import { useTranslations } from 'next-intl';
import { User } from '@/domain/entities/User';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/_shared-components/Tabs';
import classes from '../Profile.module.scss';
import DemoProfileHeader from './DemoProfileHeader';
import DemoProfileOverview from './DemoProfileOverview';
import DemoProfilePosts from './DemoProfilePosts';
import DemoProfileActivity from './DemoProfileActivity';
import DemoProfileAccounts from './DemoProfileAccounts';
import DemoProfileSettings from './DemoProfileSettings';

interface DemoProfileProps {
	user: User;
	isOwnProfile?: boolean;
}

const DEMO_TABS = {
	OVERVIEW: 'overview',
	POSTS: 'posts',
	ACTIVITY: 'activity',
	ACCOUNTS: 'accounts',
	SETTINGS: 'settings'
} as const;

function DemoProfile({ user, isOwnProfile = false }: DemoProfileProps) {
	const t = useTranslations();
	const [profileData, setProfileData] = useState<User>(user);

	const handleDisplayNameUpdate = (newName: string) => {
		setProfileData((prev) => ({ ...prev, displayName: newName }));
	};

	return (
		<Tabs defaultValue={DEMO_TABS.OVERVIEW}>
			{/* Cover image */}
			<div className='relative'>
				<Image
					src={ProfileRect}
					alt='profile-cover-image'
					className='h-[150px] w-full object-cover'
					width={1200}
					height={150}
				/>
			</div>

			{/* Header section */}
			<div className={classes.headerWrapper}>
				<DemoProfileHeader
					user={profileData}
					isOwnProfile={isOwnProfile}
					onDisplayNameUpdate={handleDisplayNameUpdate}
				/>

				{/* Tab triggers */}
				<TabsList className='mb-0 bg-transparent'>
					<TabsTrigger value={DEMO_TABS.OVERVIEW}>{t('Profile.overview')}</TabsTrigger>
					<TabsTrigger value={DEMO_TABS.ACTIVITY}>{t('Profile.activity')}</TabsTrigger>
					<TabsTrigger value={DEMO_TABS.POSTS}>{t('Profile.posts')}</TabsTrigger>
					<TabsTrigger value={DEMO_TABS.ACCOUNTS}>{t('Profile.accounts')}</TabsTrigger>
					{isOwnProfile && <TabsTrigger value={DEMO_TABS.SETTINGS}>{t('Profile.settings')}</TabsTrigger>}
				</TabsList>
			</div>

			{/* Tab content */}
			<div className={classes.contentWrapper}>
				<TabsContent value={DEMO_TABS.OVERVIEW}>
					<DemoProfileOverview user={profileData} />
				</TabsContent>
				<TabsContent value={DEMO_TABS.ACTIVITY}>
					<DemoProfileActivity />
				</TabsContent>
				<TabsContent value={DEMO_TABS.POSTS}>
					<DemoProfilePosts uid={profileData.uid} />
				</TabsContent>
				<TabsContent value={DEMO_TABS.ACCOUNTS}>
					<DemoProfileAccounts user={profileData} />
				</TabsContent>
				{isOwnProfile && (
					<TabsContent value={DEMO_TABS.SETTINGS}>
						<DemoProfileSettings
							user={profileData}
							onDisplayNameUpdate={handleDisplayNameUpdate}
						/>
					</TabsContent>
				)}
			</div>
		</Tabs>
	);
}

export default DemoProfile;
