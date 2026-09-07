// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { clientDb } from '@/app/_client-services/firebase/firebaseClientApp';
import { ReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';

interface DemoReferendaRealtimeStatsProps {
	index: number;
}

function DemoReferendaRealtimeStats({ index }: DemoReferendaRealtimeStatsProps) {
	const [stats, setStats] = useState<ReferendumStatsDto | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Fetch initial stats via SSR-friendly API
		fetch(`/api/v2/referenda/${index}/stats`)
			.then((r) => r.json())
			.then(setStats)
			.catch(() => {});

		// Subscribe to realtime updates from the aggregate stats doc
		const statsRef = doc(clientDb, 'referenda', String(index), 'stats', 'current');
		const unsubscribe = onSnapshot(
			statsRef,
			(snapshot) => {
				if (!snapshot.exists()) {
					setStats(null);
					return;
				}
				const data = snapshot.data();
				setStats({
					ayePoints: (data.ayePoints as number) ?? 0,
					nayPoints: (data.nayPoints as number) ?? 0,
					abstainPoints: (data.abstainPoints as number) ?? 0,
					ayeVoters: (data.ayeVoters as number) ?? 0,
					nayVoters: (data.nayVoters as number) ?? 0,
					abstainVoters: (data.abstainVoters as number) ?? 0,
					totalVoters: (data.totalVoters as number) ?? 0,
					approvalBps: 0,
					participatingPoints: 0,
					updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString()
				});
			},
			(err) => {
				// eslint-disable-next-line no-console
				console.error('[DemoReferendaRealtimeStats] onSnapshot error:', err);
				setError('Unable to load live results.');
			}
		);

		return () => unsubscribe();
	}, [index]);

	if (error) {
		return <div className='mb-6 text-sm text-failure'>{error}</div>;
	}

	if (!stats) {
		return <div className='mb-6 text-sm text-wallet_btn_text'>No vote data yet.</div>;
	}

	const total = stats.ayePoints + stats.nayPoints + stats.abstainPoints;
	const ayePct = total > 0 ? Math.round((stats.ayePoints / total) * 100) : 0;
	const nayPct = total > 0 ? Math.round((stats.nayPoints / total) * 100) : 0;
	const abstainPct = total > 0 ? Math.round((stats.abstainPoints / total) * 100) : 0;
	const approvalDenom = stats.ayePoints + stats.nayPoints;
	const approvalPct = approvalDenom > 0 ? Math.round((stats.ayePoints / approvalDenom) * 100) : 0;

	return (
		<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
			<h3 className='mb-3 text-sm font-semibold text-text_primary'>
				Results{' '}
				<span className='text-xs font-normal text-wallet_btn_text'>
					({stats.totalVoters} {stats.totalVoters === 1 ? 'voter' : 'voters'})
				</span>
			</h3>

			{/* Aye bar */}
			<div className='mb-2'>
				<div className='mb-1 flex items-center justify-between text-xs'>
					<span className='font-medium text-success'>Aye</span>
					<span className='text-wallet_btn_text'>
						{stats.ayePoints} points ({ayePct}%)
					</span>
				</div>
				<div className='h-2.5 w-full overflow-hidden rounded-full bg-grey_bg'>
					<div
						className='h-2.5 rounded-full bg-success transition-all duration-500'
						style={{ width: `${ayePct}%` }}
					/>
				</div>
			</div>

			{/* Nay bar */}
			<div className='mb-2'>
				<div className='mb-1 flex items-center justify-between text-xs'>
					<span className='font-medium text-failure'>Nay</span>
					<span className='text-wallet_btn_text'>
						{stats.nayPoints} points ({nayPct}%)
					</span>
				</div>
				<div className='h-2.5 w-full overflow-hidden rounded-full bg-grey_bg'>
					<div
						className='h-2.5 rounded-full bg-failure transition-all duration-500'
						style={{ width: `${nayPct}%` }}
					/>
				</div>
			</div>

			{/* Abstain bar */}
			{stats.abstainPoints > 0 && (
				<div className='mb-2'>
					<div className='mb-1 flex items-center justify-between text-xs'>
						<span className='font-medium text-decision_bar_indicator'>Abstain</span>
						<span className='text-wallet_btn_text'>
							{stats.abstainPoints} points ({abstainPct}%)
						</span>
					</div>
					<div className='h-2.5 w-full overflow-hidden rounded-full bg-grey_bg'>
						<div
							className='h-2.5 rounded-full bg-decision_bar_indicator transition-all duration-500'
							style={{ width: `${abstainPct}%` }}
						/>
					</div>
				</div>
			)}

			{/* Approval */}
			<div className='mt-3 border-t border-border_grey pt-2 text-xs text-wallet_btn_text'>
				Approval: {approvalPct}% &middot; Turnout: {total} points
			</div>
		</div>
	);
}

export default DemoReferendaRealtimeStats;
