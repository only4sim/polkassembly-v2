// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import Link from 'next/link';
import { DemoPost } from '@/domain/entities/Post';
import { dayjs } from '@/_shared/_utils/dayjsInit';
import { ArrowLeftIcon } from 'lucide-react';
import { Separator } from '@ui/Separator';
import dynamic from 'next/dynamic';
import { Skeleton } from '@ui/Skeleton';

const MarkdownViewer = dynamic(() => import('@ui/MarkdownViewer/MarkdownViewer').then((m) => m.MarkdownViewer), {
	ssr: false,
	loading: () => (
		<div className='flex flex-col gap-2'>
			<Skeleton className='h-4 w-full' />
			<Skeleton className='h-4 w-5/6' />
			<Skeleton className='h-4 w-4/6' />
		</div>
	)
});

interface DemoPostDetailProps {
	post: DemoPost;
}

/** Returns a human-readable topic label. */
function formatTopic(topic: string): string {
	return topic.charAt(0).toUpperCase() + topic.slice(1).replace(/([A-Z])/g, ' $1');
}

function getTopicStyle(topic: string): string {
	switch (topic) {
		case 'governance':
			return 'bg-[#EEF0FB] text-[#5B46D9]';
		case 'treasury':
			return 'bg-[#E0F4EC] text-[#2EA86A]';
		case 'technicalCommittee':
			return 'bg-[#FFF3E0] text-[#D4820A]';
		case 'democracy':
			return 'bg-[#FDE8F5] text-[#C4247A]';
		default:
			return 'bg-[#ECF1FF] text-[#4F6CF0]';
	}
}

function DemoPostDetail({ post }: DemoPostDetailProps) {
	return (
		<div>
			{/* Sticky header — mirrors PostHeader layout */}
			<div className='sticky top-12 z-20 w-full bg-bg_modal px-4 pt-6 shadow-lg lg:px-16'>
				{/* Breadcrumb */}
				<div className='mb-4 flex items-center gap-x-1 px-0'>
					<ArrowLeftIcon className='h-3 w-4' />
					<Link
						href='/discussions'
						className='flex items-center gap-x-1 text-xs text-listing_page_btn hover:underline'
					>
						View All Discussions
					</Link>
				</div>

				{/* Title + meta */}
				<div className='mb-4'>
					<p className='text-xl font-bold text-text_primary lg:text-2xl'>{post.title}</p>
					<div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-2'>
						<span className='text-sm font-medium text-text_primary'>{post.authorName}</span>

						{post.topic && (
							<>
								<Separator
									orientation='vertical'
									className='h-3'
								/>
								<span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${getTopicStyle(post.topic)}`}>{formatTopic(post.topic)}</span>
							</>
						)}

						<Separator
							orientation='vertical'
							className='h-3'
						/>
						<span className='text-xs text-wallet_btn_text'>{dayjs(post.createdAt).format('MMM D, YYYY')}</span>

						{post.tags && post.tags.length > 0 && (
							<>
								<Separator
									orientation='vertical'
									className='h-3'
								/>
								<div className='flex flex-wrap gap-1'>
									{post.tags.map((tag) => (
										<span
											key={tag}
											className='rounded-full border border-border_grey px-2 py-0.5 text-[10px] text-wallet_btn_text'
										>
											{tag}
										</span>
									))}
								</div>
							</>
						)}
					</div>
				</div>

				{/* Tab bar (Description only for now) */}
				<div className='flex items-center gap-1 overflow-x-auto py-2'>
					<button
						type='button'
						className='flex-shrink-0 border-b-2 border-text_pink px-1 py-1 text-[11px] font-bold text-text_pink sm:px-3 sm:py-2 sm:text-sm'
					>
						Description
					</button>
				</div>
			</div>

			{/* Main content */}
			<div className='mx-auto max-w-7xl px-4 py-6 lg:px-16'>
				<div className='rounded-xl border border-primary_border bg-bg_modal p-4 lg:p-6'>
					<MarkdownViewer markdown={post.content} />
				</div>
			</div>
		</div>
	);
}

export default DemoPostDetail;
