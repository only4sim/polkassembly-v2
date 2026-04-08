// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DemoPost } from '@/domain/entities/Post';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';

interface DemoProfilePostsProps {
	uid: string;
}

function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function DemoProfilePosts({ uid }: DemoProfilePostsProps) {
	const [posts, setPosts] = useState<DemoPost[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				// Use the current user's token if available, otherwise fetch without auth
				const { currentUser } = clientAuth;
				const token = currentUser ? await currentUser.getIdToken() : null;
				const res = await fetch(`/api/v2/posts/by-author/${uid}`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
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
	}, [uid]);

	if (loading) {
		return (
			<div className='flex items-center justify-center py-12 text-wallet_btn_text'>
				<span>Loading posts…</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className='flex items-center justify-center py-12 text-red-500'>
				<span>{error}</span>
			</div>
		);
	}

	if (posts.length === 0) {
		return (
			<div className='flex flex-col items-center justify-center py-12 text-wallet_btn_text'>
				<p>No posts yet.</p>
			</div>
		);
	}

	return (
		<div className='flex flex-col divide-y divide-border_grey'>
			{posts.map((post) => (
				<Link
					key={post.id}
					href={`/discussions/${post.id}`}
					className='flex flex-col gap-y-1 px-2 py-4 transition-colors hover:bg-bg_modal'
				>
					<p className='line-clamp-2 text-base font-semibold text-text_primary'>{post.title}</p>
					<p className='line-clamp-2 text-sm text-wallet_btn_text'>{post.content}</p>
					<p className='mt-1 text-xs text-wallet_btn_text'>{formatDate(post.createdAt)}</p>
				</Link>
			))}
		</div>
	);
}

export default DemoProfilePosts;
