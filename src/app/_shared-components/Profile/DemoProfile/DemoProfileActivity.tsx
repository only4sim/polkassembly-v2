// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import noData from '@assets/activityfeed/gifs/noactivity.gif';
import { Separator } from '@/app/_shared-components/Separator';
import StatusTag from '@ui/StatusTag/StatusTag';
import { EProposalStatus } from '@/_shared/types';
import { fetchMyPointsVotes, type MyVoteHistoryEntry } from '@/app/_client-services/points_referenda_client_service';

interface DemoProfileActivityProps {
	/** Vote history is owner-only audit data (plan PR-8): rendered for the signed-in user's own profile. */
	isOwnProfile?: boolean;
}

/**
 * Profile activity tab (plan PR-8): shows the signed-in user's own points
 * Referenda vote history with owner-only audit fields. Other users' profiles
 * keep the privacy-preserving empty state — vote data is never exposed
 * cross-user (contract: own-vote read only).
 */
function DemoProfileActivity({ isOwnProfile = false }: DemoProfileActivityProps) {
	const t = useTranslations('Profile');
	const tRef = useTranslations('DemoReferenda');
	const [entries, setEntries] = useState<MyVoteHistoryEntry[] | null>(null);
	const [totalCount, setTotalCount] = useState(0);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOwnProfile) return undefined;
		let cancelled = false;
		fetchMyPointsVotes({ limit: 20 })
			.then((page) => {
				if (cancelled) return;
				setEntries(page.items);
				setTotalCount(page.totalCount);
			})
			.catch(() => {
				if (cancelled) return;
				setError(tRef('errors.generic'));
			});
		return () => {
			cancelled = true;
		};
	}, [isOwnProfile, tRef]);

	const showEmptyState = !isOwnProfile || (entries !== null && entries.length === 0 && !error);

	return (
		<div className='flex w-full flex-col gap-y-4 rounded-[20px] border-[0.6px] border-border_grey bg-bg_modal px-6 py-4 pb-6 shadow-lg'>
			<header className='flex items-center justify-between'>
				<h2 className='text-2xl font-bold'>{t('Votes.votes')}</h2>
				{isOwnProfile && entries !== null && <span className='text-sm text-wallet_btn_text'>({totalCount})</span>}
			</header>
			<Separator />

			{showEmptyState ? (
				<div
					className='mt-0 flex w-full flex-col items-center justify-center'
					role='status'
				>
					<Image
						src={noData}
						alt='No votes data available'
						width={300}
						height={300}
						priority
					/>
					<p className='text-text_secondary mb-2 mt-0'>{t('Votes.noData')}</p>
				</div>
			) : error ? (
				<p
					className='text-sm text-failure'
					role='alert'
				>
					{error}
				</p>
			) : entries === null ? (
				<p className='text-sm text-wallet_btn_text'>Loading…</p>
			) : (
				<ul className='divide-y divide-border_grey'>
					{entries.map((entry) => (
						<li
							key={`${entry.referendum?.index ?? 'x'}-${entry.vote.uid}`}
							className='py-3'
						>
							<div className='flex items-center justify-between gap-2'>
								{entry.referendum ? (
									<Link
										href={`/referenda/${entry.referendum.index}`}
										className='text-sm font-medium text-btn_secondary_text hover:underline'
									>
										#{entry.referendum.index} {entry.referendum.title}
									</Link>
								) : (
									<span className='text-sm text-wallet_btn_text'>#{entry.vote.uid}</span>
								)}
								{entry.referendum && <StatusTag status={entry.referendum.status as unknown as EProposalStatus} />}
							</div>
							<div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-wallet_btn_text'>
								<span className='font-medium capitalize text-text_primary'>{entry.vote.decision}</span>
								<span>
									{entry.vote.pointsUsed} {tRef('points')}
								</span>
								<span>
									{tRef('yourBalance')}: {entry.vote.balanceAtVote}
								</span>
								<span>{new Date(entry.vote.updatedAt).toLocaleString()}</span>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export default DemoProfileActivity;
