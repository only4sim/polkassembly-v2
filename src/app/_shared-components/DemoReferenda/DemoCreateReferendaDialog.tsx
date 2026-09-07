// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useCallback, useState } from 'react';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { useToast } from '@/hooks/useToast';
import { ENotificationStatus } from '@/_shared/types';
import { Button } from '@/app/_shared-components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/_shared-components/Dialog/Dialog';

interface Props {
	onClose: () => void;
	onCreated: () => void;
}

function DemoCreateReferendaDialog({ onClose, onCreated }: Props) {
	const { toast } = useToast();
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [origin, setOrigin] = useState('root');
	const [tags, setTags] = useState('');
	const [votingStartsAt, setVotingStartsAt] = useState('');
	const [votingEndsAt, setVotingEndsAt] = useState('');
	const [approvalThresholdBps, setApprovalThresholdBps] = useState(5000);
	const [minimumTurnoutPoints, setMinimumTurnoutPoints] = useState(100);
	const [isLoading, setIsLoading] = useState(false);

	const handleCreate = useCallback(async () => {
		const u = clientAuth.currentUser;
		if (!u) {
			toast({ title: 'Please log in.', status: ENotificationStatus.WARNING });
			return;
		}
		if (!title.trim() || !content.trim()) {
			toast({ title: 'Title and content required.', status: ENotificationStatus.WARNING });
			return;
		}
		if (!votingStartsAt || !votingEndsAt) {
			toast({ title: 'Voting dates required.', status: ENotificationStatus.WARNING });
			return;
		}
		setIsLoading(true);
		try {
			const token = await u.getIdToken();
			if (!token) throw new Error('Not authenticated');
			const res = await fetch('/api/v2/referenda', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					title,
					content,
					origin,
					tags: tags
						? tags
								.split(',')
								.map((t) => t.trim())
								.filter(Boolean)
						: [],
					votingStartsAt: new Date(votingStartsAt).toISOString(),
					votingEndsAt: new Date(votingEndsAt).toISOString(),
					approvalThresholdBps,
					minimumTurnoutPoints
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({ message: 'Creation failed.' }));
				throw new Error(body.message || 'Creation failed.');
			}
			toast({ title: 'Referendum created!', status: ENotificationStatus.SUCCESS });
			onCreated();
		} catch (err) {
			toast({ title: (err as Error).message || 'Failed.', status: ENotificationStatus.ERROR });
		} finally {
			setIsLoading(false);
		}
	}, [title, content, origin, tags, votingStartsAt, votingEndsAt, approvalThresholdBps, minimumTurnoutPoints, toast, onCreated]);
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className='max-w-xl p-4 sm:p-6'>
				<DialogHeader>
					<DialogTitle className='text-xl font-semibold text-text_primary'>Create Referendum</DialogTitle>
				</DialogHeader>
				<div className='space-y-4'>
					<div>
						{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
						<label className='mb-1 block text-sm font-medium text-text_primary'>
							Title
							<input
								type='text'
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
								placeholder='Enter title'
							/>
						</label>
					</div>
					<div>
						{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
						<label className='mb-1 block text-sm font-medium text-text_primary'>
							Content
							<textarea
								value={content}
								onChange={(e) => setContent(e.target.value)}
								rows={4}
								className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
								placeholder='Describe your referendum'
							/>
						</label>
					</div>
					<div>
						{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
						<label className='mb-1 block text-sm font-medium text-text_primary'>
							Origin
							<select
								value={origin}
								onChange={(e) => setOrigin(e.target.value)}
								className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
							>
								<option value='root'>Root</option>
								<option value='whitelisted_caller'>Whitelisted Caller</option>
								<option value='general_admin'>General Admin</option>
								<option value='treasurer'>Treasurer</option>
							</select>
						</label>
					</div>
					<div className='grid grid-cols-2 gap-4'>
						<div>
							{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
							<label className='mb-1 block text-sm font-medium text-text_primary'>
								Voting Starts
								<input
									type='datetime-local'
									value={votingStartsAt}
									onChange={(e) => setVotingStartsAt(e.target.value)}
									className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
								/>
							</label>
						</div>
						<div>
							{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
							<label className='mb-1 block text-sm font-medium text-text_primary'>
								Voting Ends
								<input
									type='datetime-local'
									value={votingEndsAt}
									onChange={(e) => setVotingEndsAt(e.target.value)}
									className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
								/>
							</label>
						</div>
					</div>
					<div className='grid grid-cols-2 gap-4'>
						<div>
							{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
							<label className='mb-1 block text-sm font-medium text-text_primary'>
								Approval (bps)
								<input
									type='number'
									min={0}
									max={10000}
									value={approvalThresholdBps}
									onChange={(e) => setApprovalThresholdBps(Number(e.target.value))}
									className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
								/>
							</label>
						</div>
						<div>
							{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
							<label className='mb-1 block text-sm font-medium text-text_primary'>
								Min Turnout
								<input
									type='number'
									min={0}
									value={minimumTurnoutPoints}
									onChange={(e) => setMinimumTurnoutPoints(Number(e.target.value))}
									className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
								/>
							</label>
						</div>
					</div>
					<div>
						{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
						<label className='mb-1 block text-sm font-medium text-text_primary'>
							Tags (comma separated)
							<input
								type='text'
								value={tags}
								onChange={(e) => setTags(e.target.value)}
								placeholder='e.g. treasury, gov'
								className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
							/>
						</label>
					</div>
					<div className='flex justify-end gap-2'>
						<Button
							variant='ghost'
							onClick={onClose}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreate}
							isLoading={isLoading}
						>
							Create
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default DemoCreateReferendaDialog;
