// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ChevronDown, Pencil } from 'lucide-react';
import Image from 'next/image';
import ShieldUser from '@assets/icons/shield-user.svg';
import DeleteIcon from '@assets/icons/delete-icon.svg';
import { User } from '@/domain/entities/User';
import { THEME_COLORS } from '@/app/_style/theme';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { Separator } from '@/app/_shared-components/Separator';
import { Button } from '@/app/_shared-components/Button';
import { Input } from '@/app/_shared-components/Input';
import { Label } from '@/app/_shared-components/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/_shared-components/Dialog/Dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/_shared-components/Collapsible';
import classes from '../Settings/Settings.module.scss';

interface DemoProfileSettingsProps {
	user: Pick<User, 'uid' | 'email' | 'displayName'>;
	onDisplayNameUpdate?: (newName: string) => void;
}

const DELETE_CONFIRMATION_TEXT = 'delete';

function DemoProfileSettings({ user, onDisplayNameUpdate }: DemoProfileSettingsProps) {
	const t = useTranslations('Profile');
	const router = useRouter();

	// Edit display name state
	const [editOpen, setEditOpen] = useState(false);
	const [displayNameInput, setDisplayNameInput] = useState(user.displayName || '');
	const [savingName, setSavingName] = useState(false);
	const [nameError, setNameError] = useState<string | null>(null);

	// Delete account state
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteInput, setDeleteInput] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const handleSaveDisplayName = async () => {
		if (!displayNameInput.trim()) return;
		setSavingName(true);
		setNameError(null);
		try {
			const currentUser = clientAuth.currentUser;
			if (!currentUser) throw new Error('Not authenticated');
			const token = await currentUser.getIdToken();
			const res = await fetch('/api/v2/users/me/demo', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ displayName: displayNameInput.trim() })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { message?: string }).message || 'Failed to update display name');
			}
			onDisplayNameUpdate?.(displayNameInput.trim());
			setEditOpen(false);
		} catch (e) {
			setNameError((e as Error).message);
		} finally {
			setSavingName(false);
		}
	};

	const handleDeleteAccount = async () => {
		if (deleteInput !== DELETE_CONFIRMATION_TEXT) return;
		setDeleting(true);
		setDeleteError(null);
		try {
			const currentUser = clientAuth.currentUser;
			if (!currentUser) throw new Error('Not authenticated');

			// Delete Firestore document first via API
			const token = await currentUser.getIdToken();
			const deleteRes = await fetch('/api/v2/users/me/demo', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` }
			});
			// Proceed even if the Firestore delete fails (doc may not exist),
			// but surface unexpected server errors (not 404/500 is acceptable here).
			if (!deleteRes.ok && deleteRes.status !== 404 && deleteRes.status !== 500) {
				throw new Error(`Failed to remove account data (${deleteRes.status})`);
			}

			// Then delete the Firebase Auth user
			await currentUser.delete();

			setDeleteOpen(false);
			router.replace('/');
		} catch (e) {
			const msg = (e as Error).message;
			if (msg.includes('requires-recent-login')) {
				setDeleteError('For security, please log out and log back in before deleting your account.');
			} else {
				setDeleteError(msg);
			}
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div className={classes.accountsWrapper}>
			<div className={classes.accountsHeader}>
				<p className={classes.accountsHeaderText}>{t('Settings.settings')}</p>
			</div>
			<Separator className='mb-4' />
			<div className={classes.settingsContent}>
				{/* Profile Settings */}
				<Collapsible
					defaultOpen
					className={classes.settingsCollapsible}
				>
					<CollapsibleTrigger className='w-full'>
						<div className={classes.collapsibleTrigger}>
							<p className={classes.collapsibleTriggerText}>
								<Image
									src={ShieldUser}
									alt='shield-user'
								/>
								{t('Settings.profileSettings')}
							</p>
							<ChevronDown className={classes.collapsibleTriggerIcon} />
						</div>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<Separator />
						<div className={classes.collapsibleContent}>
							{/* Display Name */}
							<div className={classes.collapsibleContentItem}>
								<div className='text-sm'>
									<p className='mb-1 text-wallet_btn_text'>Display Name</p>
									<p className='font-medium text-text_primary'>{user.displayName || '—'}</p>
								</div>
								<Dialog
									open={editOpen}
									onOpenChange={setEditOpen}
								>
									<Button
										variant='ghost'
										leftIcon={
											<Pencil
												size={16}
												fill={THEME_COLORS.light.text_pink}
											/>
										}
										className='text-sm font-medium text-text_pink'
										onClick={() => setEditOpen(true)}
									>
										{t('Settings.edit')}
									</Button>
									<DialogContent className='max-w-xl p-3 sm:p-6'>
										<DialogHeader>
											<DialogTitle>Edit Display Name</DialogTitle>
											<DialogDescription className='sr-only'>Update your display name</DialogDescription>
										</DialogHeader>
										<div className='flex flex-col gap-y-4'>
											<div>
												<Label htmlFor='old-display-name'>Current Display Name</Label>
												<Input
													id='old-display-name'
													defaultValue={user.displayName || ''}
													disabled
												/>
											</div>
											<div>
												<Label htmlFor='new-display-name'>New Display Name</Label>
												<Input
													id='new-display-name'
													placeholder='Enter new display name'
													value={displayNameInput}
													onChange={(e) => setDisplayNameInput(e.target.value)}
												/>
											</div>
											{nameError && <p className='text-xs text-red-500'>{nameError}</p>}
											<div className='flex justify-end'>
												<Button
													disabled={!displayNameInput.trim()}
													onClick={handleSaveDisplayName}
													isLoading={savingName}
												>
													{t('Settings.save')}
												</Button>
											</div>
										</div>
									</DialogContent>
								</Dialog>
							</div>
							<Separator />
							{/* Email (read-only) */}
							{user.email && (
								<div className='text-sm'>
									<p className='mb-1 text-wallet_btn_text'>{t('Settings.email')}</p>
									<p className='font-medium text-text_primary'>{user.email}</p>
								</div>
							)}
						</div>
					</CollapsibleContent>
				</Collapsible>

				{/* Delete Account */}
				<Collapsible className={classes.settingsCollapsible}>
					<CollapsibleTrigger className='w-full'>
						<div className={classes.collapsibleTrigger}>
							<p className={classes.collapsibleTriggerText}>
								<Image
									src={DeleteIcon}
									alt='delete-icon'
								/>
								{t('Settings.deleteAccount')}
							</p>
							<ChevronDown className={classes.collapsibleTriggerIcon} />
						</div>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<Separator />
						<div className={classes.collapsibleContent}>
							<p className='font-medium text-text_primary'>{t('Settings.deleteAccountDescription')}</p>
							<Dialog
								open={deleteOpen}
								onOpenChange={(open) => {
									setDeleteOpen(open);
									if (!open) {
										setDeleteInput('');
										setDeleteError(null);
									}
								}}
							>
								<Button
									variant='destructive'
									onClick={() => setDeleteOpen(true)}
								>
									{t('Settings.deleteMyAccount')}
								</Button>
								<DialogContent className='max-w-xl p-3 sm:p-6'>
									<DialogHeader>
										<DialogTitle>{t('Settings.deleteAccount')}</DialogTitle>
										<DialogDescription className='sr-only'>Confirm account deletion</DialogDescription>
									</DialogHeader>
									<div>
										<p className='text-text_secondary mb-4 text-sm'>{t('Settings.deleteAccountDescription')}</p>
										<div className='mb-4'>
											<p className='mb-1 text-sm text-text_primary'>
												{t('Settings.type')} &quot;{DELETE_CONFIRMATION_TEXT}&quot; {t('Settings.belowToConfirm')}
											</p>
											<Input
												value={deleteInput}
												onChange={(e) => setDeleteInput(e.target.value)}
											/>
										</div>
										{deleteError && <p className='mb-2 text-xs text-red-500'>{deleteError}</p>}
										<Button
											variant='destructive'
											onClick={handleDeleteAccount}
											isLoading={deleting}
											disabled={deleteInput !== DELETE_CONFIRMATION_TEXT}
										>
											{t('Settings.deleteMyAccount')}
										</Button>
									</div>
								</DialogContent>
							</Dialog>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</div>
		</div>
	);
}

export default DemoProfileSettings;
