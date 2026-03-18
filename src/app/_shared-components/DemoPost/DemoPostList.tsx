// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaRegClock } from '@react-icons/all-files/fa/FaRegClock';
import { DemoPost } from '@/domain/entities/Post';
import { dayjs } from '@/_shared/_utils/dayjsInit';

interface DemoPostListProps {
	/** Initial posts pre-fetched on the server (SSR). May be empty for client-only render. */
	initialPosts?: DemoPost[];
}

/** Returns a human-readable topic label from the raw topic value. */
function formatTopic(topic: string): string {
	return topic.charAt(0).toUpperCase() + topic.slice(1).replace(/([A-Z])/g, ' $1');
}

/** Tailwind colour pair for topic badges — mirrors TopicTag palette. */
function getTopicStyle(topic: string): string {
	switch (topic) {
		case 'governance':
			return 'bg-[#EEF0FB] text-[#5B46D9]';
		case 'treasury':
			return 'bg-[#E0F4EC] text-[#2EA86A]';
		case 'technical':
			return 'bg-[#FFF3E0] text-[#D4820A]';
		case 'technicalCommittee':
			return 'bg-[#FFF3E0] text-[#D4820A]';
		case 'democracy':
			return 'bg-[#FDE8F5] text-[#C4247A]';
		default:
			return 'bg-[#ECF1FF] text-[#4F6CF0]';
	}
}

function PostCardSkeleton() {
	return (
		<div className='flex animate-pulse flex-col gap-2 border-b border-border_grey p-4 sm:p-6'>
			<div className='h-4 w-3/4 rounded bg-gray-200' />
			<div className='h-3 w-1/2 rounded bg-gray-100' />
		</div>
	);
}

function DemoPostList({ initialPosts = [] }: DemoPostListProps) {
	const [posts, setPosts] = useState<DemoPost[]>(initialPosts);
	const [loading, setLoading] = useState(initialPosts.length === 0);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (initialPosts.length > 0) {
			return undefined;
		}

		let cancelled = false;
		(async () => {
			try {
				const res = await fetch('/api/v2/posts');
				if (!res.ok) throw new Error('Failed to fetch posts');
				const data = (await res.json()) as { posts: DemoPost[] };
				if (!cancelled) setPosts(data.posts);
			} catch (err) {
				if (!cancelled) setError((err as Error).message);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [initialPosts.length]);

	if (loading) {
		return (
			<div className='flex flex-col'>
				{[1, 2, 3].map((i) => (
					<PostCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className='flex items-center justify-center py-16 text-red-500'>
				<span>{error}</span>
			</div>
		);
	}

	if (posts.length === 0) {
		return (
			<div className='flex flex-col items-center justify-center py-16 text-wallet_btn_text'>
				<p className='mb-2 text-lg font-medium'>No discussions yet</p>
				<p className='text-sm'>
					Be the first to{' '}
					<Link
						href='/create/discussion'
						className='text-text_pink underline'
					>
						start a discussion
					</Link>
					.
				</p>
			</div>
		);
	}

	return (
		<div className='flex flex-col divide-y divide-border_grey'>
			{posts.map((post, idx) => (
				<Link
					key={post.id}
					href={`/discussions/${post.id}`}
					className='flex flex-col-reverse items-start justify-between gap-2 p-3 transition-colors hover:bg-page_background md:flex-row md:items-center md:p-6'
				>
					{/* Left: index + content */}
					<div className='flex items-start gap-3 lg:gap-4'>
						<p className='pl-2 text-sidebar_text md:pl-5'>#{idx + 1}</p>
						<div className='flex flex-col gap-1'>
							<h3 className='pl-2 text-left text-sm font-medium text-btn_secondary_text lg:pl-0'>{post.title}</h3>
							<div className='flex flex-col gap-1 pl-2 align-middle text-sm text-gray-500 md:gap-2.5 lg:flex-row lg:items-center lg:pl-0'>
								<div className='flex items-center gap-2'>
									<span className='text-xs font-medium text-text_primary'>{post.authorName}</span>
									<span>|</span>
									{post.createdAt && (
										<span className='flex items-center gap-1 text-xs text-text_primary'>
											<FaRegClock className='h-3 w-3 md:h-3.5 md:w-3.5' />
											<span className='whitespace-nowrap text-[10px] md:text-xs'>{dayjs(post.createdAt).fromNow()}</span>
										</span>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Right: topic badge + tags */}
					<div className='flex flex-row items-center gap-2 lg:flex-col lg:items-end'>
						{post.topic && (
							<span className={`rounded-md px-2 py-0.5 text-xs font-medium ${getTopicStyle(post.topic)}`}>{formatTopic(post.topic)}</span>
						)}
						{post.tags && post.tags.length > 0 && (
							<div className='flex flex-wrap gap-1'>
								{post.tags.slice(0, 3).map((tag) => (
									<span
										key={tag}
										className='rounded-full border border-border_grey px-2 py-0.5 text-[10px] text-wallet_btn_text'
									>
										{tag}
									</span>
								))}
							</div>
						)}
					</div>
				</Link>
			))}
		</div>
	);
}

export default DemoPostList;
