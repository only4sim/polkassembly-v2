// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import Link from 'next/link';
import { ReferendumSummaryDto } from '@/domain/dtos/ReferendaDtos';
import { EProposalStatus } from '@/_shared/types';
import StatusTag from '@/app/_shared-components/StatusTag/StatusTag';

interface DemoReferendaCardProps {
	data: ReferendumSummaryDto;
}

function DemoReferendaCard({ data }: DemoReferendaCardProps) {
	return (
		<Link
			href={`/referenda/${data.index}`}
			className='flex w-full items-center justify-between gap-1 p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 md:flex-row md:p-6'
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
				</div>
			</div>
			<div className='flex items-center gap-2'>
				<StatusTag status={data.status as unknown as EProposalStatus} />
			</div>
		</Link>
	);
}

export default DemoReferendaCard;
