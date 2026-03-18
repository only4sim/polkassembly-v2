// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import Link from 'next/link';
import { DemoPost } from '@/domain/entities/Post';

interface DemoPostDetailProps {
	post: DemoPost;
}

function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

function DemoPostDetail({ post }: DemoPostDetailProps) {
	return (
		<div className='mx-auto w-full max-w-screen-lg rounded-lg bg-bg_modal p-4 shadow-lg sm:p-8'>
			{/* Breadcrumb */}
			<p className='mb-4 text-sm text-wallet_btn_text'>
				<Link
					href='/discussions'
					className='text-text_pink hover:underline'
				>
					Discussions
				</Link>
				<span className='mx-1'>/</span>
				<span className='text-text_primary'>{post.title}</span>
			</p>

			{/* Post header */}
			<h1 className='mb-2 text-2xl font-bold text-text_primary'>{post.title}</h1>
			<div className='mb-6 flex items-center gap-x-2 text-sm text-wallet_btn_text'>
				<span className='font-medium text-text_primary'>{post.authorName}</span>
				<span>·</span>
				<span>{formatDate(post.createdAt)}</span>
			</div>

			{/* Post content */}
			<div className='whitespace-pre-wrap text-sm leading-relaxed text-text_primary'>{post.content}</div>
		</div>
	);
}

export default DemoPostDetail;
