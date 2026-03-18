// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DemoPost } from '@/domain/entities/Post';

interface DemoPostListProps {
	/** Initial posts pre-fetched on the server (SSR). May be empty for client-only render. */
	initialPosts?: DemoPost[];
}

function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function DemoPostList({ initialPosts = [] }: DemoPostListProps) {
	const [posts, setPosts] = useState<DemoPost[]>(initialPosts);
	const [loading, setLoading] = useState(initialPosts.length === 0);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (initialPosts.length > 0) return undefined;

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
			<div className='flex items-center justify-center py-16 text-wallet_btn_text'>
				<span>Loading discussions…</span>
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
			{posts.map((post) => (
				<Link
					key={post.id}
					href={`/discussions/${post.id}`}
					className='flex flex-col gap-y-1 px-4 py-4 transition-colors hover:bg-bg_modal sm:px-6'
				>
					<p className='line-clamp-2 text-base font-semibold text-text_primary'>{post.title}</p>
					<p className='line-clamp-2 text-sm text-wallet_btn_text'>{post.content}</p>
					<div className='mt-1 flex items-center gap-x-2 text-xs text-wallet_btn_text'>
						<span className='font-medium text-text_primary'>{post.authorName}</span>
						<span>·</span>
						<span>{formatDate(post.createdAt)}</span>
					</div>
				</Link>
			))}
		</div>
	);
}

export default DemoPostList;
