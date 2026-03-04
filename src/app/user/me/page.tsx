// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { User } from '@/domain/entities/User';
import DemoProfile from '@/app/_shared-components/Profile/DemoProfile/DemoProfile';

function MePageContent() {
	const router = useRouter();
	const [profileData, setProfileData] = useState<User | null>(null);
	const [fetchError, setFetchError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		const unsubscribe = onAuthStateChanged(clientAuth, async (firebaseUser: FirebaseUser | null) => {
			if (cancelled) return;

			if (!firebaseUser) {
				setLoading(false);
				router.replace('/login');
				return;
			}

			try {
				// Get token directly from the Firebase User object to guarantee it is non-null
				const token = await firebaseUser.getIdToken();
				if (cancelled) return;

				const res = await fetch('/api/v2/users/me/demo', {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (cancelled) return;

				if (res.status === 404) {
					setFetchError('User not found');
					setLoading(false);
					return;
				}
				if (!res.ok) {
					setFetchError('Failed to load profile');
					setLoading(false);
					return;
				}
				const data = await res.json();
				setProfileData({
					...data,
					createdAt: new Date(data.createdAt),
					updatedAt: new Date(data.updatedAt)
				});
				setLoading(false);
			} catch {
				if (!cancelled) {
					setFetchError('Failed to load profile');
					setLoading(false);
				}
			}
		});

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [router]);

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
