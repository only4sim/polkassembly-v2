// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type ReferendaAdminOverview } from '@/app/_client-services/points_referenda_client_service';
import { fetchReferendaAdminOverview, PointsReferendaApiError } from '@/app/_client-services/points_referenda_client_service';
import { Button } from '@/app/_shared-components/Button';
import StatusTag from '@/app/_shared-components/StatusTag/StatusTag';
import { EProposalStatus } from '@/_shared/types';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { onAuthStateChanged } from 'firebase/auth';

const STATUS_ORDER = ['Submitted', 'Deciding', 'Confirmed', 'Rejected', 'Cancelled'];

/**
 * Admin operations panel (plan P2): lifecycle status counts + recent
 * referenda with aggregate stats. Server-verified admin only (403 otherwise);
 * not linked from public navigation — reachable at /referenda/admin.
 */
function ReferendaAdminPanelPage() {
	const t = useTranslations('DemoReferenda');
	const [authReady, setAuthReady] = useState(false);
	const [overview, setOverview] = useState<ReferendaAdminOverview | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(clientAuth, () => setAuthReady(true));
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		if (!authReady) return undefined;
		let cancelled = false;
		setLoading(true);
		setError(null);
		fetchReferendaAdminOverview()
			.then((data) => {
				if (!cancelled) setOverview(data);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof PointsReferendaApiError ? err.message : t('errors.generic'));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [authReady, t]);

	return (
		<div className='container mx-auto px-4 py-6'>
			<div className='mb-4 flex items-center justify-between'>
				<h1 className='text-2xl font-bold text-text_primary'>{t('adminPanel.title')}</h1>
				<Link
					href='/referenda'
					className='text-sm text-text_pink hover:underline'
				>
					{t('feed.viewAll')}
				</Link>
			</div>

			{loading ? (
				<div className='flex h-40 items-center justify-center text-sm text-wallet_btn_text'>Loading…</div>
			) : error ? (
				<div
					className='flex h-40 flex-col items-center justify-center gap-3'
					role='alert'
				>
					<p className='text-sm text-failure'>{error}</p>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => window.location.reload()}
					>
						{t('retry')}
					</Button>
				</div>
			) : overview ? (
				<>
					<div className='mb-6 grid grid-cols-2 gap-3 md:grid-cols-5'>
						{STATUS_ORDER.map((status) => (
							<div
								key={status}
								className='rounded-lg border border-border_grey bg-bg_modal p-3 text-center'
							>
								<p className='text-xs capitalize text-wallet_btn_text'>{status}</p>
								<p className='text-xl font-bold text-text_primary'>{overview.statusCounts[status] ?? 0}</p>
							</div>
						))}
						<div className='col-span-2 rounded-lg border border-border_grey bg-bg_modal p-3 text-center md:col-span-5'>
							<p className='text-xs text-wallet_btn_text'>{t('adminPanel.total')}</p>
							<p className='text-2xl font-bold text-text_primary'>{overview.totalReferenda}</p>
						</div>
					</div>

					<div className='rounded-lg border border-border_grey bg-bg_modal p-4'>
						<h2 className='mb-2 text-sm font-semibold text-text_primary'>{t('adminPanel.recent')}</h2>
						<ul className='divide-y divide-border_grey'>
							{overview.recent.map(({ referendum, stats }) => (
								<li
									key={referendum.index}
									className='flex items-center justify-between py-2 text-sm'
								>
									<Link
										href={`/referenda/${referendum.index}`}
										className='font-medium text-btn_secondary_text hover:underline'
									>
										#{referendum.index} {referendum.title}
									</Link>
									<div className='flex items-center gap-3 text-xs text-wallet_btn_text'>
										{stats && (
											<span>
												{stats.participatingPoints} {t('points')} · {stats.totalVoters} {t('votes').toLowerCase()}
											</span>
										)}
										<StatusTag status={referendum.status as unknown as EProposalStatus} />
									</div>
								</li>
							))}
						</ul>
					</div>
				</>
			) : null}
		</div>
	);
}

export default ReferendaAdminPanelPage;
