// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useState } from 'react';
import { ReferendumDetailDto, ReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import StatusTag from '@/app/_shared-components/StatusTag/StatusTag';
import { EProposalStatus } from '@/_shared/types';
import DemoReferendaRealtimeStats from '@/app/_shared-components/DemoReferenda/DemoReferendaRealtimeStats';
import DemoReferendaVoteDialog from '@/app/_shared-components/DemoReferenda/DemoReferendaVoteDialog';
import { Button } from '@/app/_shared-components/Button';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { onAuthStateChanged } from 'firebase/auth';

interface Props {
	params: Promise<{ index: string }>;
}

function DemoReferendaDetail({ params }: Props) {
	const [index, setIndex] = useState<number | null>(null);
	const [referendum, setReferendum] = useState<ReferendumDetailDto | null>(null);
	const [myVote, setMyVote] = useState<ReferendumVoteDto | null>(null);
	const [loading, setLoading] = useState(true);
	const [authReady, setAuthReady] = useState(false);
	const [authUid, setAuthUid] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	useEffect(() => {
		params.then((p) => setIndex(Number(p.index)));
	}, [params]);

	// Wait for Firebase auth readiness
	useEffect(() => {
		const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
			setAuthReady(true);
			setAuthUid(user?.uid ?? null);
		});
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		if (index === null || !authReady) return;
		setLoading(true);

		async function load() {
			try {
				// Fetch referendum detail (public)
				const refRes = await fetch(`/api/v2/referenda/${index}`);
				const refData = await refRes.json();
				setReferendum(refData);

				// Fetch own vote only if authenticated
				if (authUid) {
					const token = await clientAuth.currentUser?.getIdToken();
					if (token) {
						const voteRes = await fetch(`/api/v2/referenda/${index}/votes/me`, {
							headers: { Authorization: `Bearer ${token}` }
						});
						if (voteRes.ok) {
							const voteData = await voteRes.json();
							// Accept only proper vote objects (not error bodies)
							if (voteData && voteData.uid) {
								setMyVote(voteData);
							}
						}
					}
				}
			} catch {
				// Error handled by empty states
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [index, authReady, authUid]);

	if (loading) {
		return <div className='flex h-60 items-center justify-center text-sm text-wallet_btn_text'>Loading...</div>;
	}

	if (!referendum) {
		return <div className='flex h-60 items-center justify-center text-sm text-wallet_btn_text'>Referendum not found.</div>;
	}

	const isDeciding = referendum.status === 'Deciding';

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
			</div>

			<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
				<div className='prose prose-sm dark:prose-invert max-w-none'>{referendum.content}</div>
			</div>

			{/* Voting - only for authenticated users when Deciding */}
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
			{isDeciding && !authUid && authReady && (
				<div className='mb-6'>
					<p className='text-sm text-wallet_btn_text'>Please log in to vote.</p>
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

			<DemoReferendaRealtimeStats index={referendum.index} />

			{dialogOpen && (
				<DemoReferendaVoteDialog
					index={referendum.index}
					existingVote={myVote}
					onClose={() => setDialogOpen(false)}
					onVoteChanged={(vote) => {
						setMyVote(vote);
						setDialogOpen(false);
					}}
					onVoteRemoved={() => {
						setMyVote(null);
						setDialogOpen(false);
					}}
				/>
			)}
		</div>
	);
}

export default DemoReferendaDetail;
