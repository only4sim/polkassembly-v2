// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useEffect, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { clientDb } from '@/app/_client-services/firebase/firebaseClientApp';
import { type ReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';
import { statsDtoFromSnapshotData } from '@/app/_client-services/points_referenda_client_service';

interface DemoReferendaRealtimeStatsProps {
	index: number;
	/** Server-rendered initial aggregate (plan PR-5) — shown before/at listener failure. */
	initialStats: ReferendumStatsDto | null;
}

function pct(part: number, total: number): number {
	return total > 0 ? Math.round((part / total) * 100) : 0;
}

function DemoReferendaRealtimeStats({ index, initialStats }: DemoReferendaRealtimeStatsProps) {
	// Hydration-safe: state is seeded from the SERVER-provided value, so the
	// first client render matches SSR markup exactly.
	const [stats, setStats] = useState<ReferendumStatsDto | null>(initialStats);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Exactly ONE realtime listener on referenda/{index}/stats/current —
		// no HTTP seed fetch that could race with (and overwrite) the snapshot.
		const statsRef = doc(clientDb, 'referenda', String(index), 'stats', 'current');
		const unsubscribe = onSnapshot(
			statsRef,
			(snapshot) => {
				if (!snapshot.exists()) {
					setStats(null);
					return;
				}
				// Snapshot → DTO via the shared client-service mapper (single
				// source of validation/normalisation).
				const dto = statsDtoFromSnapshotData(snapshot.data() as Record<string, unknown>);
				if (dto) {
					setStats(dto);
					setError(null);
				}
			},
			(err) => {
				// eslint-disable-next-line no-console
				console.error('[DemoReferendaRealtimeStats] onSnapshot error:', err);
				// Preserve the last known value; just mark the feed stale.
				setError('Live results are unavailable — showing the last known results.');
			}
		);

		return () => unsubscribe();
	}, [index]);

	if (!stats) {
		return <div className='mb-6 text-sm text-wallet_btn_text'>No vote data yet.</div>;
	}

	const total = stats.participatingPoints + stats.abstainPoints;
	const ayePct = pct(stats.ayePoints, stats.participatingPoints);
	const nayPct = pct(stats.nayPoints, stats.participatingPoints);
	const abstainPct = pct(stats.abstainPoints, total);
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
				{error && <span className='ml-2 text-xs font-normal text-failure'>{error}</span>}
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
