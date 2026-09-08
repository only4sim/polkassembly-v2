// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReferendumDetailDto, ReferendumVoteDto, type PublicReferendumVoteDto, type ReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';
import StatusTag from '@/app/_shared-components/StatusTag/StatusTag';
import { EProposalStatus } from '@/_shared/types';
import DemoReferendaRealtimeStats from '@/app/_shared-components/DemoReferenda/DemoReferendaRealtimeStats';
import DemoReferendaVoteDialog from '@/app/_shared-components/DemoReferenda/DemoReferendaVoteDialog';
import { Button } from '@/app/_shared-components/Button';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { onAuthStateChanged } from 'firebase/auth';
import { fetchMyVote } from '@/app/_client-services/points_referenda_client_service';

interface Props {
	index: number;
	initialDetail: ReferendumDetailDto | null;
	initialStats: ReferendumStatsDto | null;
	initialHistory: { items: PublicReferendumVoteDto[]; totalCount: number } | null;
	serverError: boolean;
}

function DemoReferendaDetail({ index, initialDetail, initialStats, initialHistory, serverError }: Props) {
	const router = useRouter();
	const referendum = initialDetail;
	const [myVote, setMyVote] = useState<ReferendumVoteDto | null>(null);
	const [myVoteState, setMyVoteState] = useState<'loading' | 'loaded' | 'error'>('loading');
	const [authReady, setAuthReady] = useState(false);
	const [authUid, setAuthUid] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	// Auth state machine (plan PR-5): anonymous → no own vote; logout or user
	// switch MUST clear the previously displayed vote immediately.
	useEffect(() => {
		const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
			setAuthReady(true);
			const uid = user?.uid ?? null;
			setAuthUid(uid);
			if (!uid) {
				setMyVote(null);
				setMyVoteState('loaded');
			}
		});
		return () => unsubscribe();
	}, []);

	// Own vote: fetched only for an authenticated user, via the client service.
	// 401 (expired token) is surfaced as an error rather than shown as a vote.
	const loadMyVote = useCallback(async () => {
		if (!authUid) return;
		setMyVoteState('loading');
		try {
			const vote = await fetchMyVote(index);
			setMyVote(vote);
			setMyVoteState('loaded');
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[DemoReferendaDetail] failed to load own vote:', err);
			setMyVote(null);
			setMyVoteState('error');
		}
	}, [authUid, index]);

	useEffect(() => {
		if (authReady && authUid) {
			loadMyVote();
		}
	}, [authReady, authUid, loadMyVote]);

	if (serverError || !referendum) {
		return (
			<div className='container mx-auto flex h-60 flex-col items-center justify-center gap-3 px-4'>
				<span className='text-sm text-failure'>Unable to load this referendum. Please try again.</span>
				<Button
					variant='ghost'
					size='sm'
					onClick={() => router.refresh()}
				>
					Retry
				</Button>
			</div>
		);
	}

	const isDeciding = referendum.status === 'Deciding';
	const authResolved = authReady;

	return (
		<div className='container mx-auto px-4 py-6'>
			<div className='mb-4'>
				<div className='flex items-center gap-3'>
					<h1 className='text-2xl font-bold text-text_primary'>
						#{referendum.index} {referendum.title}
					</h1>
					<StatusTag status={referendum.status as unknown as EProposalStatus} />
				</div>
				<p className='mt-1 text-sm text-wallet_btn_text'>
					by {referendum.authorDisplayName} &middot; {new Date(referendum.createdAt).toLocaleDateString()}
					{referendum.origin && <span className='ml-2 capitalize'>({referendum.origin})</span>}
				</p>
				{/* Voting window and thresholds — previously backend-only fields */}
				<p className='mt-1 text-xs text-wallet_btn_text'>
					Voting: {new Date(referendum.votingStartsAt).toLocaleString()} → {new Date(referendum.votingEndsAt).toLocaleString()} &middot; Approval ≥{' '}
					{(referendum.approvalThresholdBps / 100).toFixed(2)}% &middot; Min turnout {referendum.minimumTurnoutPoints} points
				</p>
				{referendum.tags.length > 0 && (
					<div className='mt-2 flex flex-wrap gap-2'>
						{referendum.tags.map((tag) => (
							<span
								key={tag}
								className='rounded-full border border-border_grey px-2 py-0.5 text-xs text-wallet_btn_text'
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>

			<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
				<div className='prose prose-sm dark:prose-invert max-w-none'>{referendum.content}</div>
			</div>

			{/* Voting - only for authenticated users while Deciding */}
			{isDeciding && authUid && (
				<div className='mb-6'>
					<Button
						size='lg'
						onClick={() => setDialogOpen(true)}
					>
						{myVote ? 'Change Vote' : 'Cast Vote'}
					</Button>
				</div>
			)}
			{isDeciding && !authUid && authResolved && (
				<div className='mb-6'>
					<p className='text-sm text-wallet_btn_text'>Please log in to vote.</p>
				</div>
			)}

			{myVoteState === 'error' && authUid && (
				<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
					<p className='text-sm text-failure'>Could not load your vote. Please try again later.</p>
				</div>
			)}

			{myVote && (
				<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
					<p className='text-sm font-semibold text-text_primary'>Your Vote</p>
					<p className='mt-1 text-sm capitalize'>
						{myVote.decision} &middot; {myVote.pointsUsed} points
					</p>
				</div>
			)}

			<DemoReferendaRealtimeStats
				index={referendum.index}
				initialStats={initialStats}
			/>

			{/* Privacy-safe public vote history (no UID, no balance — contract) */}
			{initialHistory && initialHistory.items.length > 0 && (
				<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
					<h3 className='mb-2 text-sm font-semibold text-text_primary'>
						Votes <span className='text-xs font-normal text-wallet_btn_text'>({initialHistory.totalCount})</span>
					</h3>
					<ul className='divide-y divide-border_grey'>
						{initialHistory.items.map((vote, i) => (
							<li
								// eslint-disable-next-line react/no-array-index-key
								key={`${vote.voterDisplayName}-${vote.updatedAt}-${i}`}
								className='flex items-center justify-between py-2 text-sm'
							>
								<span className='text-text_primary'>{vote.voterDisplayName}</span>
								<span className='capitalize text-wallet_btn_text'>
									{vote.decision} &middot; {vote.pointsUsed} points
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{dialogOpen && (
				<DemoReferendaVoteDialog
					index={referendum.index}
					existingVote={myVote}
					onClose={() => setDialogOpen(false)}
					onVoteChanged={(vote) => {
						setMyVote(vote);
						setMyVoteState('loaded');
						setDialogOpen(false);
					}}
					onVoteRemoved={() => {
						setMyVote(null);
						setMyVoteState('loaded');
						setDialogOpen(false);
					}}
				/>
			)}
		</div>
	);
}

export default DemoReferendaDetail;
