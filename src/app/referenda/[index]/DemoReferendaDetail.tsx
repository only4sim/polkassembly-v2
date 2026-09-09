// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/useToast';
import { ReferendumDetailDto, ReferendumVoteDto, type PublicReferendumVoteDto, type ReferendumCommentDto, type ReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';
import StatusTag from '@/app/_shared-components/StatusTag/StatusTag';
import { EProposalStatus, ENotificationStatus } from '@/_shared/types';
import DemoReferendaRealtimeStats from '@/app/_shared-components/DemoReferenda/DemoReferendaRealtimeStats';
import DemoReferendaVoteBubbles from '@/app/_shared-components/DemoReferenda/DemoReferendaVoteBubbles';
import DemoReferendaVoteDialog from '@/app/_shared-components/DemoReferenda/DemoReferendaVoteDialog';
import { Button } from '@/app/_shared-components/Button';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { onAuthStateChanged } from 'firebase/auth';
import {
	fetchMyVote,
	fetchReferendumCapabilities,
	type ReferendumCapabilitiesDto,
	cancelReferendum,
	adminFinalizeReferendum
} from '@/app/_client-services/points_referenda_client_service';
import DemoReferendaComments from '@/app/_shared-components/DemoReferenda/DemoReferendaComments';

interface Props {
	index: number;
	initialDetail: ReferendumDetailDto | null;
	initialStats: ReferendumStatsDto | null;
	initialHistory: { items: PublicReferendumVoteDto[]; totalCount: number } | null;
	initialComments: { items: ReferendumCommentDto[]; totalCount: number } | null;
	decisionFilter?: 'aye' | 'nay' | 'abstain';
	serverError: boolean;
}

function DemoReferendaDetail({ index, initialDetail, initialStats, initialHistory, initialComments, decisionFilter, serverError }: Props) {
	const router = useRouter();
	const { toast } = useToast();
	const t = useTranslations('DemoReferenda');
	const referendum = initialDetail;
	const [myVote, setMyVote] = useState<ReferendumVoteDto | null>(null);
	const [myVoteState, setMyVoteState] = useState<'loading' | 'loaded' | 'error'>('loading');
	const [authReady, setAuthReady] = useState(false);
	const [authUid, setAuthUid] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [capabilities, setCapabilities] = useState<ReferendumCapabilitiesDto | null>(null);
	const [isCancelling, setIsCancelling] = useState(false);
	const [isFinalizing, setIsFinalizing] = useState(false);

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

	// Trusted server capabilities (admin flag, voting window, pointsBalance).
	// Refetched whenever the authenticated user changes (login/logout/switch).
	useEffect(() => {
		let cancelled = false;
		if (!authReady) return undefined;
		fetchReferendumCapabilities(index)
			.then((caps) => {
				if (!cancelled) setCapabilities(caps);
			})
			.catch(() => {
				if (!cancelled) setCapabilities(null);
			});
		return () => {
			cancelled = true;
		};
	}, [authReady, authUid, index]);

	// Admin cancellation: double-confirmed; server re-verifies the admin role.
	const handleCancel = useCallback(async () => {
		if (!window.confirm(t('admin.confirmBody'))) return;
		setIsCancelling(true);
		try {
			await cancelReferendum(index);
			toast({ title: t('admin.cancelled'), status: ENotificationStatus.SUCCESS });
			router.refresh();
		} catch (err) {
			toast({ title: (err as Error).message || t('errors.generic'), status: ENotificationStatus.ERROR });
		} finally {
			setIsCancelling(false);
		}
	}, [index, t, toast, router]);

	// Admin manual finalization (same exact algorithm as the scheduler).
	const handleFinalize = useCallback(async () => {
		if (!window.confirm(t('admin.finalizeConfirm'))) return;
		setIsFinalizing(true);
		try {
			await adminFinalizeReferendum(index);
			toast({ title: t('admin.finalized'), status: ENotificationStatus.SUCCESS });
			router.refresh();
		} catch (err) {
			toast({ title: (err as Error).message || t('errors.generic'), status: ENotificationStatus.ERROR });
		} finally {
			setIsFinalizing(false);
		}
	}, [index, t, toast, router]);

	if (serverError || !referendum) {
		return (
			<div className='container mx-auto flex h-60 flex-col items-center justify-center gap-3 px-4'>
				<span className='text-sm text-failure'>{t('errors.loadFailed')}</span>
				<Button
					variant='ghost'
					size='sm'
					onClick={() => router.refresh()}
				>
					{t('retry')}
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
					{t('window')}: {new Date(referendum.votingStartsAt).toLocaleString()} → {new Date(referendum.votingEndsAt).toLocaleString()} &middot; {t('approvalThreshold')}{' '}
					{(referendum.approvalThresholdBps / 100).toFixed(2)}% &middot; {t('minTurnout')} {referendum.minimumTurnoutPoints} {t('points')}
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

			{/* Voting - capability-driven (server-trusted), only for authenticated users */}
			{isDeciding && authUid && capabilities?.canVote && (
				<div className='mb-6'>
					<Button
						size='lg'
						onClick={() => setDialogOpen(true)}
					>
						{myVote ? t('changeVote') : t('castVote')}
					</Button>
				</div>
			)}
			{isDeciding && !authUid && authResolved && (
				<div className='mb-6'>
					<p className='text-sm text-wallet_btn_text'>{t('loginToVote')}</p>
				</div>
			)}
			{isDeciding && authUid && capabilities && !capabilities.isVotingOpen && (
				<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
					<p className='text-sm text-wallet_btn_text'>{t('errors.notOpen')}</p>
				</div>
			)}

			{/* Voting window ended on a still-Deciding referendum: the scheduled
			lifecycle processor finalizes it in production; show the pending
			state and give admins a manual finalize action (local dev / ops). */}
			{referendum.status === 'Deciding' && capabilities && !capabilities.isVotingOpen && (
				<div
					className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'
					role='status'
				>
					<p className='text-sm text-wallet_btn_text'>{t('errors.endedPending')}</p>
					{capabilities.canCancel && (
						<Button
							size='sm'
							isLoading={isFinalizing}
							onClick={handleFinalize}
							className='mt-2'
						>
							{t('admin.finalizeButton')}
						</Button>
					)}
				</div>
			)}

			{/* Admin-only cancellation (server-verified capability, double confirm) */}
			{capabilities?.canCancel && (
				<div className='mb-6 rounded-lg border border-failure/40 bg-failure/5 p-4'>
					<p className='text-sm font-semibold text-failure'>{t('admin.title')}</p>
					<Button
						variant='ghost'
						size='sm'
						isLoading={isCancelling}
						onClick={handleCancel}
						className='mt-2 text-failure hover:bg-failure/10'
					>
						{t('admin.cancelButton')}
					</Button>
				</div>
			)}

			{myVoteState === 'error' && authUid && (
				<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
					<p className='text-sm text-failure'>{t('errors.ownVoteFailed')}</p>
				</div>
			)}

			{myVote && (
				<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
					<p className='text-sm font-semibold text-text_primary'>{t('yourVote')}</p>
					<p className='mt-1 text-sm capitalize'>
						{myVote.decision} &middot; {myVote.pointsUsed} points
					</p>
				</div>
			)}

			<DemoReferendaRealtimeStats
				index={referendum.index}
				initialStats={initialStats}
			/>

			{/* Points-native bubble view of the public history (independent P2 visual) */}
			{initialHistory && initialHistory.items.length > 0 && <DemoReferendaVoteBubbles votes={initialHistory.items} />}

			{/* Privacy-safe public vote history (no UID, no balance — contract) */}
			{initialHistory && (
				<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
					<div className='mb-2 flex items-center justify-between'>
						<h3 className='text-sm font-semibold text-text_primary'>
							{t('votes')} <span className='text-xs font-normal text-wallet_btn_text'>({initialHistory.totalCount})</span>
						</h3>
						{/* URL-driven decision filter (plan PR-7) */}
						<div className='flex gap-2'>
							{(['aye', 'nay', 'abstain'] as const).map((d) => (
								<Link
									key={d}
									href={decisionFilter === d ? `/referenda/${index}` : `/referenda/${index}?decision=${d}`}
									className={`rounded-full border px-2 py-0.5 text-xs capitalize ${decisionFilter === d ? 'border-text_pink bg-text_pink text-white' : 'border-border_grey text-wallet_btn_text'}`}
								>
									{d}
								</Link>
							))}
						</div>
					</div>
					{initialHistory.items.length === 0 ? (
						<p className='text-sm text-wallet_btn_text'>{t('noVotes')}</p>
					) : (
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
					)}
				</div>
			)}

			{/* Referendum comments (plan PR-7) */}
			<DemoReferendaComments
				index={index}
				initialComments={initialComments}
			/>

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
