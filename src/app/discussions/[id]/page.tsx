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
		// Server components must not self-fetch over HTTP: NEXT_PUBLIC_APP_URL may
		// point at a remote deployment whose Firestore does not contain this post.
		// Call the trusted service in-process, mirroring the referenda detail page.
		const { DemoPostService } = await import('@/app/api/_api-services/demoPostService');
		const post = await DemoPostService.getPostById(id);
		return { title: post?.title || 'Discussion' };
	} catch {
		return { title: 'Discussion' };
	}
}

async function DemoDiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
	if (process.env.ENABLE_BLOCKCHAIN === 'true') {
		notFound();
	}

	const { id } = await params;
	if (!id) notFound();

	let post: DemoPost | null = null;

	try {
		const { DemoPostService } = await import('@/app/api/_api-services/demoPostService');
		post = await DemoPostService.getPostById(id);
	} catch {
		// Infrastructure failure — treat like any other fetch failure.
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
