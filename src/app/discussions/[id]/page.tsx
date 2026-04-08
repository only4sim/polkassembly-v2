// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { DemoPost } from '@/domain/entities/Post';
import DemoPostDetail from '@/app/_shared-components/DemoPost/DemoPostDetail';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const { id } = await params;
	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
		const res = await fetch(`${baseUrl}/api/v2/posts/${id}`, { cache: 'no-store' });
		if (!res.ok) return { title: 'Discussion Not Found' };
		const { post } = (await res.json()) as { post: DemoPost };
		return { title: post.title };
	} catch {
		return { title: 'Discussion' };
	}
}

async function DemoDiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
	if (process.env.ENABLE_BLOCKCHAIN === 'true') {
		notFound();
	}

	const { id } = await params;
	let post: DemoPost | null = null;

	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
		const res = await fetch(`${baseUrl}/api/v2/posts/${id}`, { cache: 'no-store' });
		if (res.status === 404) notFound();
		if (!res.ok) throw new Error('Failed to fetch post');
		const data = (await res.json()) as { post: DemoPost };
		post = data.post;
	} catch {
		notFound();
	}

	if (!post) notFound();

	return (
		<div className='w-full'>
			<DemoPostDetail post={post} />
		</div>
	);
}

export default DemoDiscussionDetailPage;
