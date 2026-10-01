// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React from 'react';
import { type ReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';
import { useReferendumStats } from '@/hooks/usePointsReferenda';

interface DemoReferendaRealtimeStatsProps {
	index: number;
	/** Server-rendered initial aggregate (plan PR-5) — shown before/at listener failure. */
	initialStats: ReferendumStatsDto | null;
}

function pct(part: number, total: number): number {
	return total > 0 ? Math.round((part / total) * 100) : 0;
}

function DemoReferendaRealtimeStats({ index, initialStats }: DemoReferendaRealtimeStatsProps) {
	// F02 fix: React Query + Firestore listener via the hook is the single source
	// of truth. The initialStats prop seeds the cache for hydration-safe SSR.
	const { data: stats, isError } = useReferendumStats({ index, initialData: initialStats });

	if (!stats) {
		return <div className='mb-6 text-sm text-wallet_btn_text'>No vote data yet.</div>;
	}

	// F05 fix: participatingPoints already includes abstainPoints (aye + nay + abstain).
	// Use it as the single denominator so all three bars sum to 100%.
	const ayePct = pct(stats.ayePoints, stats.participatingPoints);
	const nayPct = pct(stats.nayPoints, stats.participatingPoints);
	const abstainPct = pct(stats.abstainPoints, stats.participatingPoints);
	const approvalPct = Math.round((stats.approvalBps / 100) * 100) / 100;

	return (
		<div
			className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'
			aria-live='polite'
			aria-atomic='false'
		>
			<h3 className='mb-3 text-sm font-semibold text-text_primary'>
				Results{' '}
				<span className='text-xs font-normal text-wallet_btn_text'>
					({stats.totalVoters} {stats.totalVoters === 1 ? 'voter' : 'voters'})
				</span>
				{isError && <span className='ml-2 text-xs font-normal text-failure'>Live results are unavailable — showing the last known results.</span>}
			</h3>

			{/* Aye bar */}
			<div className='mb-2'>
				<div className='mb-1 flex items-center justify-between text-xs'>
					<span className='font-medium text-success'>
						Aye <span className='text-wallet_btn_text'>({stats.ayeVoters})</span>
					</span>
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
					<span className='font-medium text-failure'>
						Nay <span className='text-wallet_btn_text'>({stats.nayVoters})</span>
					</span>
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
						<span className='font-medium text-decision_bar_indicator'>
							Abstain <span className='text-wallet_btn_text'>({stats.abstainVoters})</span>
						</span>
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

			{/* Approval + turnout (server-computed fields, single semantics) */}
			<div className='mt-3 border-t border-border_grey pt-2 text-xs text-wallet_btn_text'>
				Approval: {approvalPct}% &middot; Turnout: {stats.participatingPoints} points &middot; Updated {new Date(stats.updatedAt).toLocaleTimeString()}
			</div>
		</div>
	);
}

export default DemoReferendaRealtimeStats;
