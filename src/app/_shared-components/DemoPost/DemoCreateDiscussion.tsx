// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { Button } from '@/app/_shared-components/Button';
import { Input } from '@/app/_shared-components/Input';
import { Label } from '@/app/_shared-components/Label';

function DemoCreateDiscussion() {
	const router = useRouter();
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { currentUser } = clientAuth;

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!title.trim() || !content.trim()) return;
		if (!currentUser) {
			setError('You must be logged in to create a post.');
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const token = await currentUser.getIdToken();
			const res = await fetch('/api/v2/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ title: title.trim(), content: content.trim() })
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { message?: string };
				throw new Error(body.message || 'Failed to create discussion');
			}

			const { post } = (await res.json()) as { post: { id: string } };
			router.push(`/discussions/${post.id}`);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	if (!currentUser) {
		return (
			<p className='flex items-center gap-x-1 text-sm text-text_primary'>
				Please{' '}
				<Link
					href='/login'
					className='text-text_pink'
				>
					log in
				</Link>{' '}
				to create a discussion.
			</p>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className='flex flex-col gap-y-4'
		>
			<div>
				<Label htmlFor='demo-post-title'>Title</Label>
				<Input
					id='demo-post-title'
					placeholder='Enter a descriptive title'
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					disabled={loading}
					required
				/>
			</div>
			<div>
				<Label htmlFor='demo-post-content'>Content</Label>
				<textarea
					id='demo-post-content'
					placeholder='Share your thoughts...'
					value={content}
					onChange={(e) => setContent(e.target.value)}
					disabled={loading}
					required
					rows={8}
					className='w-full rounded-md border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary placeholder:text-wallet_btn_text focus:outline-none focus:ring-2 focus:ring-text_pink disabled:opacity-50'
				/>
			</div>
			{error && <p className='text-sm text-red-500'>{error}</p>}
			<div className='flex justify-end'>
				<Button
					type='submit'
					size='lg'
					className='px-12'
					isLoading={loading}
					disabled={!title.trim() || !content.trim()}
				>
					Create
				</Button>
			</div>
		</form>
	);
}

export default DemoCreateDiscussion;
