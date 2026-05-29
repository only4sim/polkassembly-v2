// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { clientDb } from '@/app/_client-services/firebase/firebaseClientApp';
import { VoteStats } from '@/domain/entities/Vote';
import { Poll } from '@/domain/entities/Poll';

interface DemoVoteResultsProps {
	postId: string;
	poll: Poll;
}

/**
 * DemoVoteResults — real-time vote statistics bar chart.
 *
 * Subscribes to `posts/{postId}/stats/votes` via Firestore onSnapshot and
 * renders a progress-bar chart showing vote counts and percentages per option.
 */
function DemoVoteResults({ postId, poll }: DemoVoteResultsProps) {
	const [stats, setStats] = useState<VoteStats | null>(null);

	useEffect(() => {
		const statsRef = doc(clientDb, 'posts', postId, 'stats', 'votes');
		const unsubscribe = onSnapshot(
			statsRef,
			(snapshot) => {
				if (!snapshot.exists()) {
					setStats(null);
					return;
				}
				const data = snapshot.data();
				setStats({
					totalVoters: (data.totalVoters as number) ?? 0,
					optionCounts: Array.isArray(data.optionCounts) ? (data.optionCounts as number[]) : new Array(poll.options.length).fill(0),
					lastUpdated: data.lastUpdated?.toDate ? (data.lastUpdated.toDate() as Date) : new Date()
				});
			},
			(error) => {
				console.error('[DemoVoteResults] onSnapshot error:', error);
			}
		);

		return () => unsubscribe();
	}, [postId, poll.options.length]);

	const totalVoters = stats?.totalVoters ?? 0;
	const optionCounts = stats?.optionCounts ?? new Array(poll.options.length).fill(0);

	return (
		<div className='mt-4'>
			<p className='mb-3 text-sm font-medium text-text_primary'>
				Results{' '}
				<span className='text-xs font-normal text-wallet_btn_text'>
					({totalVoters} {totalVoters === 1 ? 'voter' : 'voters'})
				</span>
			</p>
			<div className='flex flex-col gap-3'>
				{poll.options.map((option, idx) => {
					const count = optionCounts[idx] ?? 0;
					const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
					return (
						<div key={option}>
							<div className='mb-1 flex items-center justify-between text-xs'>
								<span className='font-medium text-text_primary'>{option}</span>
								<span className='text-wallet_btn_text'>
									{count} {count === 1 ? 'vote' : 'votes'} ({percentage}%)
								</span>
							</div>
							<div className='h-2.5 w-full overflow-hidden rounded-full bg-grey_bg'>
								<div
									className='h-2.5 rounded-full bg-text_pink transition-all duration-500'
									style={{ width: `${percentage}%` }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default DemoVoteResults;
