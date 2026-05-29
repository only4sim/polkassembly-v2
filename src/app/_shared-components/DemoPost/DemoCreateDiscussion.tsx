// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { useForm } from 'react-hook-form';
import { EAllowedCommentor, ENotificationStatus, EOffChainPostTopic, IWritePostFormFields } from '@/_shared/types';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { Button } from '@/app/_shared-components/Button';
import { Form } from '@/app/_shared-components/Form';
import ErrorMessage from '@/app/_shared-components/ErrorMessage';
import { useToast } from '@/hooks/useToast';
import { useSuccessModal } from '@/hooks/useSuccessModal';
import { LoadingSpinner } from '@/app/_shared-components/LoadingSpinner';
import { useDemoUser } from '@/hooks/useDemoUser';
import HeaderLabel from '@/app/create/discussion/Component/HeaderLabel';
import WritePost from '../Create/WritePost/WritePost';

function SuccessModalContent({ postId }: { postId: string }) {
	return (
		<div className='flex flex-col items-center gap-y-4'>
			<p className='text-xl font-semibold text-text_primary'>Congratulations!</p>
			<p className='flex items-center gap-x-2 text-sm font-medium text-wallet_btn_text'>
				<Link
					href={`/discussions/${postId}`}
					className='text-base font-semibold text-text_pink underline'
				>
					Discussion
				</Link>{' '}
				created successfully.
			</p>
			<div className='flex items-center gap-x-2'>
				<p className='text-sm font-medium text-wallet_btn_text'>Redirecting to post</p>
				<LoadingSpinner size='small' />
			</div>
		</div>
	);
}

function DemoCreateDiscussion() {
	const { user } = useDemoUser();
	const formData = useForm<IWritePostFormFields>({
		defaultValues: {
			title: '',
			description: '',
			tags: [],
			topic: EOffChainPostTopic.GENERAL,
			allowedCommentor: EAllowedCommentor.ALL,
			isAddingPoll: false,
			pollTitle: '',
			pollOptions: ['', ''],
			pollVoteTypes: []
		}
	});

	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const router = useRouter();
	const { toast } = useToast();
	const { setOpenSuccessModal, setSuccessModalContent } = useSuccessModal();

	const handleSubmit = async (values: IWritePostFormFields) => {
		const { title, description, tags, topic, allowedCommentor, isAddingPoll, pollTitle, pollOptions, pollEndDate } = values;
		if (!title || !description) return;

		const { currentUser } = clientAuth;
		if (!currentUser) {
			setErrorMessage('You must be logged in to create a post.');
			return;
		}

		setLoading(true);
		setErrorMessage(null);

		try {
			const token = await currentUser.getIdToken();

			// Build optional poll payload
			let pollPayload: { question: string; options: string[]; endDate?: string } | undefined;
			if (isAddingPoll && pollTitle && pollTitle.trim()) {
				const validOptions = (pollOptions ?? []).map((o) => o.trim()).filter(Boolean);
				if (validOptions.length >= 2) {
					pollPayload = {
						question: pollTitle.trim(),
						options: validOptions,
						...(pollEndDate ? { endDate: pollEndDate.toISOString() } : {})
					};
				}
			}

			const res = await fetch('/api/v2/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					title: title.trim(),
					content: description.trim(),
					topic,
					tags: tags?.map((t) => t.value) ?? [],
					allowedCommentor,
					...(pollPayload ? { poll: pollPayload } : {})
				})
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { message?: string };
				throw new Error(body.message || 'Failed to create discussion');
			}

			const { post } = (await res.json()) as { post: { id: string } };
			formData.reset();

			toast({ title: 'Discussion created successfully', status: ENotificationStatus.SUCCESS });

			setSuccessModalContent(<SuccessModalContent postId={post.id} />);
			setOpenSuccessModal(true);

			router.push(`/discussions/${post.id}`);
		} catch (err) {
			const msg = (err as Error).message;
			setErrorMessage(msg);
			toast({ title: 'Failed to create discussion', description: msg, status: ENotificationStatus.ERROR });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<div className='border-b border-border_grey px-4 pb-4 sm:px-6'>
				<HeaderLabel />
			</div>
			<div className='px-4 py-4 sm:px-12'>
				<div className='relative flex flex-col gap-y-4'>
					{!user ? (
						<p className='flex items-center gap-x-1 text-center text-sm text-text_primary'>
							Please{' '}
							<Link
								href='/login'
								className='text-text_pink'
							>
								log in
							</Link>{' '}
							to create a discussion.
						</p>
					) : (
						<>
							{errorMessage && <ErrorMessage errorMessage={errorMessage} />}
							<Form {...formData}>
								<form onSubmit={formData.handleSubmit(handleSubmit)}>
									<WritePost
										disabled={loading}
										formData={formData}
									/>
									<div className='mt-4 flex justify-end'>
										<Button
											size='lg'
											className='px-12'
											type='submit'
											isLoading={loading}
										>
											Create
										</Button>
									</div>
								</form>
							</Form>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

export default DemoCreateDiscussion;
