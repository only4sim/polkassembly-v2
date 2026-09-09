// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { type PublicReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { ReferendumDecision } from '@/domain/entities/Referendum';

interface Props {
	/** Privacy-safe public history entries (already server-loaded on the detail page). */
	votes: PublicReferendumVoteDto[];
}

type Bucket = 'aye' | 'nay' | 'abstain';

const BUCKET_ORDER: Bucket[] = ['aye', 'nay', 'abstain'];
const BUCKET_BG: Record<Bucket, string> = {
	aye: 'bg-success/70',
	nay: 'bg-failure/70',
	abstain: 'bg-decision_bar_indicator/70'
};
const BUCKET_LABEL: Record<Bucket, string> = { aye: 'text-success', nay: 'text-failure', abstain: 'text-decision_bar_indicator' };

/**
 * Points-native bubble view of the PUBLIC vote history (plan P2).
 *
 * Independent visualisation: bubble AREA encodes `pointsUsed` per decision
 * bucket — no chain approval/curve algorithms are used. Uses only the
 * privacy-safe public DTO (display name, decision, points, timestamps).
 */
function DemoReferendaVoteBubbles({ votes }: Props) {
	const t = useTranslations('DemoReferenda');
	const [expanded, setExpanded] = useState(false);

	const buckets = useMemo(() => {
		const grouped: Record<Bucket, PublicReferendumVoteDto[]> = { aye: [], nay: [], abstain: [] };
		votes.forEach((v) => {
			if (v.decision === ReferendumDecision.AYE) grouped.aye.push(v);
			else if (v.decision === ReferendumDecision.NAY) grouped.nay.push(v);
			else grouped.abstain.push(v);
		});
		// Largest bubbles first inside each bucket for a stable, readable layout.
		(BUCKET_ORDER as Bucket[]).forEach((b) => grouped[b].sort((x, y) => y.pointsUsed - x.pointsUsed));
		return grouped;
	}, [votes]);

	const maxPoints = useMemo(() => votes.reduce((max, v) => Math.max(max, v.pointsUsed), 1), [votes]);

	if (votes.length === 0) return null;

	const visible = expanded ? votes.length : 30;

	return (
		<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
			<div className='mb-3 flex items-center justify-between'>
				<h3 className='text-sm font-semibold text-text_primary'>{t('bubbles.title')}</h3>
				{votes.length > 30 && (
					<button
						type='button'
						onClick={() => setExpanded((prev) => !prev)}
						className='text-xs text-text_pink hover:underline'
					>
						{expanded ? t('bubbles.showLess') : t('bubbles.showAll', { count: votes.length })}
					</button>
				)}
			</div>

			<div className='grid grid-cols-3 gap-4'>
				{BUCKET_ORDER.map((bucket) => (
					<div
						key={bucket}
						className='flex flex-col items-center gap-2'
					>
						<p className={`text-xs font-semibold capitalize ${BUCKET_LABEL[bucket]}`}>{bucket}</p>
						<div className='flex min-h-16 flex-wrap items-center justify-center gap-1.5'>
							{buckets[bucket].slice(0, expanded ? undefined : 10).map((vote, i) => {
								// Bubble area ∝ pointsUsed, clamped to 14–44px.
								const size = Math.max(14, Math.min(44, 14 + 30 * Math.sqrt(vote.pointsUsed / maxPoints)));
								return (
									<span
										// eslint-disable-next-line react/no-array-index-key
										key={`${vote.voterDisplayName}-${vote.updatedAt}-${i}`}
										title={`${vote.voterDisplayName}: ${vote.pointsUsed} ${t('points')}`}
										className={`inline-block rounded-full ${BUCKET_BG[bucket]}`}
										style={{ width: `${size}px`, height: `${size}px` }}
									/>
								);
							})}
							{buckets[bucket].length === 0 && <span className='text-xs text-grey_bg'>—</span>}
						</div>
						<p className='text-xs text-wallet_btn_text'>
							{buckets[bucket].reduce((sum, v) => sum + v.pointsUsed, 0)} {t('points')} · {buckets[bucket].length}
						</p>
					</div>
				))}
			</div>
			{!expanded && votes.length > visible && <p className='mt-1 text-center text-[10px] text-grey_bg'>{t('bubbles.truncated')}</p>}
		</div>
	);
}

export default DemoReferendaVoteBubbles;
