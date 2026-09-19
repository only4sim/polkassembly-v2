// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { redirect } from 'next/navigation';
import { User } from '@/domain/entities/User';
import { FirestoreUserRepository } from '@/adapters/firestore/FirestoreUserRepository';
import DemoProfile from '@/app/_shared-components/Profile/DemoProfile/DemoProfile';

async function fetchUserByUid(uid: string): Promise<User | null> {
	try {
		// Server components must not self-fetch over HTTP: NEXT_PUBLIC_APP_URL may
		// point at a remote deployment whose Firestore does not contain this user.
		// Call the repository in-process (same pattern as the public API route).
		const userRepository = new FirestoreUserRepository();
		const user = await userRepository.getUserByUid(uid);
		if (!user) return null;
		// Mirror the public route's privacy trimming — email is never exposed.
		return { ...user, email: '' };
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
