// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { type ReferendumCommentDto } from '@/domain/dtos/ReferendaDtos';
import { MarkdownViewer } from '@ui/MarkdownViewer/MarkdownViewer';
import { Button } from '@/app/_shared-components/Button';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { onAuthStateChanged } from 'firebase/auth';
import { useToast } from '@/hooks/useToast';
import { ENotificationStatus } from '@/_shared/types';
import CreatedAtTime from '@ui/CreatedAtTime/CreatedAtTime';
import { useReferendumComments, useAddComment, useDeleteComment } from '@/hooks/usePointsReferenda';

interface Props {
	index: number;
	/** Server-rendered first page of comments (plan PR-7). */
	initialComments: { items: ReferendumCommentDto[]; totalCount: number } | null;
}

/**
 * Referendum comments (plan PR-7). Reuses the Demo comment visual language
 * (MarkdownViewer, login gate, own-delete) without the post-path assumptions.
 * All writes go through React Query mutations; the hook handles cache
 * invalidation so the list stays consistent (F02/F03).
 */
function DemoReferendaComments({ index, initialComments }: Props) {
	const { toast } = useToast();
	const t = useTranslations('DemoReferenda');
	const [authUid, setAuthUid] = useState<string | null>(null);
	const [authReady, setAuthReady] = useState(false);
	const [content, setContent] = useState('');
	const [deletingId, setDeletingId] = useState<string | null>(null);
	// F06 fix: client-side page accumulator — "Load more" appends subsequent pages.
	const [page, setPage] = useState(1);

	const initialPage = initialComments ? { ...initialComments, page: 1, pageSize: 20 } : null;
	const { data: commentsData } = useReferendumComments({ index, page, initialData: page === 1 ? initialPage : undefined });
	const addComment = useAddComment(index);
	const deleteComment = useDeleteComment(index);

	const comments = commentsData?.items ?? initialComments?.items ?? [];
	const totalCount = commentsData?.totalCount ?? initialComments?.totalCount ?? 0;
	const hasMore = comments.length < totalCount;

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
			setAuthReady(true);
			setAuthUid(user?.uid ?? null);
		});
		return () => unsubscribe();
	}, []);

	const handleAdd = useCallback(async () => {
		const trimmed = content.trim();
		if (!trimmed || addComment.isPending) return;
		try {
			await addComment.mutateAsync({ content: trimmed });
			setContent('');
			toast({ title: t('comments.added'), status: ENotificationStatus.SUCCESS });
		} catch (err) {
			toast({ title: (err as Error).message || t('errors.generic'), status: ENotificationStatus.ERROR });
		}
	}, [content, addComment, toast, t]);

	const handleDelete = useCallback(
		async (commentId: string) => {
			if (deletingId) return;
			setDeletingId(commentId);
			try {
				await deleteComment.mutateAsync({ commentId });
				toast({ title: t('comments.deleted'), status: ENotificationStatus.SUCCESS });
			} catch (err) {
				toast({ title: (err as Error).message || t('errors.generic'), status: ENotificationStatus.ERROR });
			} finally {
				setDeletingId(null);
			}
		},
		[deletingId, deleteComment, toast, t]
	);

	return (
		<div className='mb-6 rounded-lg border border-border_grey bg-bg_modal p-4'>
			<h3 className='mb-3 text-sm font-semibold text-text_primary'>
				{t('comments.title')} <span className='text-xs font-normal text-wallet_btn_text'>({totalCount})</span>
			</h3>

			{comments.length === 0 ? (
				<p className='text-sm text-wallet_btn_text'>{t('comments.empty')}</p>
			) : (
				<ul className='divide-y divide-border_grey'>
					{comments.map((comment) => (
						<li
							key={comment.id}
							className='py-3'
						>
							<div className='flex items-center justify-between'>
								<span className='text-sm font-medium text-text_primary'>{comment.authorDisplayName}</span>
								<div className='flex items-center gap-2'>
									<span className='text-xs text-wallet_btn_text'>
										<CreatedAtTime createdAt={new Date(comment.createdAt)} />
									</span>
									{authUid && authUid === comment.authorUid && (
										<Button
											variant='ghost'
											size='sm'
											isLoading={deletingId === comment.id}
											onClick={() => handleDelete(comment.id)}
											className='text-failure hover:bg-failure/10'
										>
											{t('comments.delete')}
										</Button>
									)}
								</div>
							</div>
							<div className='prose prose-sm dark:prose-invert mt-1 max-w-none text-sm text-text_primary'>
								<MarkdownViewer markdown={comment.content} />
							</div>
						</li>
					))}
				</ul>
			)}

			{/* F06 fix: pagination — load more comments when available */}
			{hasMore && (
				<div className='mt-3 flex justify-center'>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => setPage((p) => p + 1)}
					>
						{t('comments.loadMore') ?? 'Load more'}
					</Button>
				</div>
			)}

			{/* Add comment — login gated; trusted write via React Query mutation */}
			<div className='mt-4'>
				{!authReady ? null : authUid ? (
					<div>
						<label
							htmlFor='comment-input'
							className='mb-1 block text-sm font-medium text-text_primary'
						>
							{t('comments.addPlaceholder')}
						</label>
						<textarea
							id='comment-input'
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={3}
							className='w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
						/>
						<div className='mt-2 flex justify-end'>
							<Button
								onClick={handleAdd}
								isLoading={addComment.isPending}
								disabled={!content.trim()}
							>
								{t('comments.submit')}
							</Button>
						</div>
					</div>
				) : (
					<p className='rounded-lg bg-address_input_bg p-3 text-sm text-text_primary'>{t('comments.loginPrompt')}</p>
				)}
			</div>
		</div>
	);
}

export default DemoReferendaComments;
