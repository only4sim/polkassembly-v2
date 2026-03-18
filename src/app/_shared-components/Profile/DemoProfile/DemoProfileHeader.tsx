// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { User } from '@/domain/entities/User';
import { Button } from '@/app/_shared-components/Button';
import { Input } from '@/app/_shared-components/Input';
import { Label } from '@/app/_shared-components/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/_shared-components/Dialog/Dialog';
import { useFirebaseAuth } from '@/app/_client-services/firebase/useFirebaseAuth';

interface DemoProfileHeaderProps {
	user: Pick<User, 'uid' | 'displayName' | 'email' | 'role' | 'pointsBalance' | 'createdAt'>;
	isOwnProfile: boolean;
	onDisplayNameUpdate?: (newName: string) => void;
}

function DemoProfileHeader({ user, isOwnProfile, onDisplayNameUpdate }: DemoProfileHeaderProps) {
	const t = useTranslations();
	const { getIdToken } = useFirebaseAuth();
	const [editOpen, setEditOpen] = useState(false);
	const [displayNameInput, setDisplayNameInput] = useState(user.displayName || '');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
		day: 'numeric'
	});

	const firstLetter = (user.displayName || user.email || '?').charAt(0).toUpperCase();

	const handleSave = async () => {
		setSaving(true);
		setError(null);
		try {
			const token = await getIdToken();
			const res = await fetch('/api/v2/users/me/demo', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ displayName: displayNameInput })
			});
			if (!res.ok) {
				throw new Error('Failed to update profile');
			}
			if (onDisplayNameUpdate) {
				onDisplayNameUpdate(displayNameInput);
			}
			setEditOpen(false);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className='mb-4 flex flex-col items-center gap-x-6 gap-y-4 sm:flex-row sm:items-start'>
			{/* First-letter avatar */}
			<div className='flex h-16 w-16 items-center justify-center rounded-full bg-text_pink text-2xl font-bold text-white'>{firstLetter}</div>

			<div className='flex flex-1 flex-col gap-y-2'>
				<div className='flex items-center justify-between'>
					<p className='text-center text-lg font-semibold sm:text-left lg:text-2xl'>{user.displayName || user.email}</p>
					{isOwnProfile && (
						<Button
							size='sm'
							variant='outline'
							onClick={() => setEditOpen(true)}
						>
							{t('Profile.editProfile')}
						</Button>
					)}
				</div>

				{isOwnProfile && <p className='text-sm text-wallet_btn_text'>{user.email}</p>}

				<div className='flex flex-wrap items-center gap-3'>
					{user.role === 'admin' && <span className='rounded-full bg-text_pink px-3 py-0.5 text-xs font-semibold text-white'>Admin</span>}
					<span className='flex items-center gap-x-1 text-sm text-wallet_btn_text'>📅 Joined: {joinDate}</span>
					<span className='flex items-center gap-x-1 text-sm text-wallet_btn_text'>⭐ Points: {user.pointsBalance}</span>
				</div>
			</div>

			{/* Edit Profile Dialog (MVP: displayName only) */}
			<Dialog
				open={editOpen}
				onOpenChange={setEditOpen}
			>
				<DialogContent className='max-w-sm'>
					<DialogHeader>
						<DialogTitle>{t('Profile.editProfile')}</DialogTitle>
						<DialogDescription className='sr-only'>Update your display name</DialogDescription>
					</DialogHeader>
					<div className='flex flex-col gap-4 py-4'>
						<div className='flex flex-col gap-1'>
							<Label htmlFor='demo-display-name'>Display Name</Label>
							<Input
								id='demo-display-name'
								value={displayNameInput}
								onChange={(e) => setDisplayNameInput(e.target.value)}
							/>
						</div>
						{error && <p className='text-xs text-red-500'>{error}</p>}
						<div className='flex justify-end gap-2'>
							<Button
								variant='outline'
								size='sm'
								onClick={() => setEditOpen(false)}
							>
								Cancel
							</Button>
							<Button
								size='sm'
								onClick={handleSave}
								disabled={saving}
							>
								{saving ? 'Saving…' : 'Save'}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default DemoProfileHeader;
