// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebaseAuth } from '@/app/_client-services/firebase/useFirebaseAuth';
import { User } from '@/domain/entities/User';
import DemoProfile from '@/app/_shared-components/Profile/DemoProfile/DemoProfile';

function MePageContent() {
	const { user: firebaseUser, loading, getIdToken } = useFirebaseAuth();
	const router = useRouter();
	const [profileData, setProfileData] = useState<User | null>(null);
	const [fetchError, setFetchError] = useState<string | null>(null);

	useEffect(() => {
		if (!loading && !firebaseUser) {
			router.replace('/login');
		}
	}, [loading, firebaseUser, router]);

	useEffect(() => {
		if (!firebaseUser) return;

		(async () => {
			try {
				const token = await getIdToken();
				const res = await fetch('/api/v2/users/me/demo', {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (res.status === 404) {
					setFetchError('User not found');
					return;
				}
				if (!res.ok) {
					setFetchError('Failed to load profile');
					return;
				}
				const data = await res.json();
				setProfileData({
					...data,
					createdAt: new Date(data.createdAt),
					updatedAt: new Date(data.updatedAt)
				});
			} catch {
				setFetchError('Failed to load profile');
			}
		})();
	}, [firebaseUser, getIdToken]);

	if (loading) {
		return <div className='p-8 text-text_primary'>Loading…</div>;
	}

	if (fetchError) {
		return <div className='p-8 text-text_primary'>{fetchError}</div>;
	}

	if (!profileData) {
		return <div className='p-8 text-text_primary'>Loading profile…</div>;
	}

	return (
		<div className='mx-auto h-full w-full max-w-7xl'>
			<DemoProfile
				user={profileData}
				isOwnProfile
			/>
		</div>
	);
}

export default function MePage() {
	const isBlockchainEnabled = process.env.NEXT_PUBLIC_ENABLE_BLOCKCHAIN === 'true';

	if (isBlockchainEnabled) {
		// When blockchain is enabled, this route is not applicable
		if (typeof window !== 'undefined') {
			window.location.replace('/');
		}
		return null;
	}

	return <MePageContent />;
}
