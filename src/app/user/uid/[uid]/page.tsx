// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { redirect } from 'next/navigation';
import { User } from '@/domain/entities/User';
import DemoProfile from '@/app/_shared-components/Profile/DemoProfile/DemoProfile';

async function fetchUserByUid(uid: string): Promise<User | null> {
	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
		const res = await fetch(`${baseUrl}/api/v2/users/uid/${uid}`, { cache: 'no-store' });
		if (!res.ok) return null;
		const data = await res.json();
		return {
			...data,
			// email is not returned by the public route; use empty string as fallback
			email: data.email ?? '',
			createdAt: new Date(data.createdAt),
			updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(data.createdAt)
		};
	} catch {
		return null;
	}
}

export default async function UserByUidPage({ params }: { params: Promise<{ uid: string }> }) {
	if (process.env.ENABLE_BLOCKCHAIN === 'true') {
		redirect('/');
	}

	const { uid } = await params;
	const user = await fetchUserByUid(uid);

	if (!user) {
		return (
			<div className='mx-auto max-w-7xl p-8'>
				<p className='text-text_primary'>User not found</p>
			</div>
		);
	}

	return (
		<div className='mx-auto h-full w-full max-w-7xl'>
			<DemoProfile
				user={user}
				isOwnProfile={false}
			/>
		</div>
	);
}
