// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ReferendumSummaryDto } from '@/domain/dtos/ReferendaDtos';
import { EProposalStatus } from '@/_shared/types';
import StatusTag from '@/app/_shared-components/StatusTag/StatusTag';

export interface ReferendumCardMetrics {
	ayePoints: number;
	nayPoints: number;
	participatingPoints: number;
}

interface DemoReferendaCardProps {
	data: ReferendumSummaryDto;
	/** Server-batched aggregate for this card (absent → hide metrics block). */
	metrics?: ReferendumCardMetrics;
}

function DemoReferendaCard({ data, metrics }: DemoReferendaCardProps) {
	const t = useTranslations('DemoReferenda');
	const ayeShare = metrics && metrics.participatingPoints > 0 ? Math.round((metrics.ayePoints / metrics.participatingPoints) * 100) : null;

	return (
		<Link
			href={`/referenda/${data.index}`}
			className='flex w-full items-center justify-between gap-1 p-3 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-text_pink dark:hover:bg-gray-800 md:flex-row md:p-6'
		>
			<div className='flex flex-col gap-1'>
				<div className='flex items-center gap-2'>
					<span className='text-sm text-sidebar_text'>#{data.index}</span>
					<span className='text-sm font-medium text-btn_secondary_text'>{data.title}</span>
				</div>
				<div className='flex items-center gap-2 text-xs text-text_primary'>
					{data.authorDisplayName && <span>by {data.authorDisplayName}</span>}
					<span className='capitalize'>{data.origin}</span>
					<span>{new Date(data.createdAt).toLocaleDateString()}</span>
					{/* Voting window end — previously a backend-only field */}
					<span>
						{t('endsAt')} {new Date(data.votingEndsAt).toLocaleDateString()}
					</span>
				</div>
			</div>
			<div className='flex items-center gap-2'>
				{metrics && (
					<span
						className='hidden text-xs text-wallet_btn_text md:inline'
						aria-label={`${t('ayePoints')}: ${metrics.ayePoints}, ${t('nayPoints')}: ${metrics.nayPoints}, ${t('turnout')}: ${metrics.participatingPoints}`}
					>
						{metrics.participatingPoints > 0 ? (
							<>
								<span className='text-success'>{metrics.ayePoints}</span>
								{' / '}
								<span className='text-failure'>{metrics.nayPoints}</span>
								{ayeShare !== null && <span className='ml-1'>({ayeShare}%)</span>}
							</>
						) : (
							<span>{t('noVotes')}</span>
						)}
					</span>
				)}
				<StatusTag status={data.status as unknown as EProposalStatus} />
			</div>
		</Link>
	);
}

export default DemoReferendaCard;
