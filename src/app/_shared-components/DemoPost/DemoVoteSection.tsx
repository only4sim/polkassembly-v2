// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { clientAuth, clientDb } from '@/app/_client-services/firebase/firebaseClientApp';
import { useDemoUser } from '@/hooks/useDemoUser';
import { useToast } from '@/hooks/useToast';
import { ENotificationStatus } from '@/_shared/types';
import { Poll } from '@/domain/entities/Poll';
import { Button } from '../Button';
import DemoVoteResults from './DemoVoteResults';

interface DemoVoteSectionProps {
	postId: string;
	poll: Poll;
}

/**
 * DemoVoteSection — poll question, multi-select checkboxes, and cast-vote button.
 *
 * Eligibility rules (all enforced server-side as well):
 *  - User must be logged in
 *  - User must have pointsBalance >= 1
 *  - User can only vote once per post
 */
function DemoVoteSection({ postId, poll }: DemoVoteSectionProps) {
	const { user } = useDemoUser();
	const { toast } = useToast();

	const [selected, setSelected] = useState<number[]>([]);
	const [hasVoted, setHasVoted] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [checking, setChecking] = useState(true);

	// Check if the current user has already voted
	useEffect(() => {
		if (!user) {
			setChecking(false);
			return;
		}

		const voteRef = doc(clientDb, 'posts', postId, 'votes', user.uid);
		getDoc(voteRef)
			.then((snap) => setHasVoted(snap.exists()))
			.catch(() => null)
			.finally(() => setChecking(false));
	}, [postId, user]);

	const toggleOption = useCallback((idx: number) => {
		setSelected((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
	}, []);

	const handleVote = useCallback(async () => {
		if (!user || selected.length === 0) return;

		setIsLoading(true);
		try {
			const token = await clientAuth.currentUser?.getIdToken();
			if (!token) throw new Error('Not authenticated');

			const res = await fetch(`/api/v2/posts/${postId}/vote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ selectedOptions: selected })
			});

			if (res.status === 403) {
				toast({ title: 'You need at least 1 point to vote', status: ENotificationStatus.WARNING });
				return;
			}
			if (res.status === 409) {
				toast({ title: 'You have already voted on this post', status: ENotificationStatus.INFO });
				setHasVoted(true);
				return;
			}
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { message?: string };
				throw new Error(body.message || 'Failed to cast vote');
			}

			setHasVoted(true);
			toast({ title: 'Vote cast successfully!', status: ENotificationStatus.SUCCESS });
		} catch (err) {
			toast({ title: (err as Error).message || 'Failed to cast vote', status: ENotificationStatus.ERROR });
		} finally {
			setIsLoading(false);
		}
	}, [postId, selected, user, toast]);

	const isExpired = poll.endDate ? new Date() > new Date(poll.endDate) : false;

	return (
		<div className='mt-6 rounded-xl border border-primary_border bg-bg_modal p-4 lg:p-6'>
			{/* Poll header */}
			<div className='mb-1 flex items-center gap-2'>
				<span className='rounded-md bg-[#ECF1FF] px-2 py-0.5 text-xs font-semibold text-[#4F6CF0]'>Poll</span>
				{isExpired && <span className='text-xs text-wallet_btn_text'>(Closed)</span>}
			</div>
			<p className='mb-4 text-sm font-semibold text-text_primary'>{poll.question}</p>

			{!hasVoted && !isExpired ? (
				<>
					{/* Options */}
					<div className='flex flex-col gap-2'>
						{poll.options.map((option, idx) => (
							<label
								key={option}
								htmlFor={`poll-option-${idx}`}
								className='flex cursor-pointer items-center gap-3 rounded-lg border border-border_grey px-4 py-3 text-sm transition-colors hover:border-text_pink hover:bg-grey_bg'
							>
								<input
									id={`poll-option-${idx}`}
									type='checkbox'
									className='h-4 w-4 rounded accent-text_pink'
									checked={selected.includes(idx)}
									onChange={() => toggleOption(idx)}
									disabled={!user || checking || isLoading}
								/>
								<span className='text-text_primary'>{option}</span>
							</label>
						))}
					</div>

					{/* Eligibility / status message */}
					<div className='mt-3'>
						{!user ? <p className='text-xs text-wallet_btn_text'>Please log in to vote.</p> : <p className='text-xs text-wallet_btn_text'>You need at least 1 point to vote.</p>}
					</div>

					{/* Cast vote button */}
					<div className='mt-4'>
						<Button
							size='sm'
							onClick={handleVote}
							isLoading={isLoading}
							disabled={!user || checking || selected.length === 0 || isLoading}
						>
							Cast Vote
						</Button>
					</div>
				</>
			) : (
				<>
					{hasVoted && <p className='mb-2 text-xs font-medium text-[#2EA86A]'>✓ You have voted</p>}
					{isExpired && !hasVoted && <p className='mb-2 text-xs text-wallet_btn_text'>This poll has ended.</p>}
				</>
			)}

			{/* Real-time results — always visible */}
			<DemoVoteResults
				postId={postId}
				poll={poll}
			/>
		</div>
	);
}

export default DemoVoteSection;
