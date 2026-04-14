// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Ellipsis, MessageSquare } from 'lucide-react';
import { DemoComment } from '@/domain/entities/Comment';
import { useDemoUser } from '@/hooks/useDemoUser';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { dayjs } from '@/_shared/_utils/dayjsInit';
import { Button } from '@/app/_shared-components/Button';
import { Skeleton } from '@/app/_shared-components/Skeleton';
import { Separator } from '@/app/_shared-components/Separator';
import UserIcon from '@assets/profile/user-icon.svg';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/_shared-components/DropdownMenu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DemoCommentSectionProps {
	postId: string;
}

// ---------------------------------------------------------------------------
// Single comment card
// ---------------------------------------------------------------------------

interface CommentCardProps {
	comment: DemoComment;
	currentUid: string | null;
	onDeleted: (id: string) => void;
	onEdited: (updated: DemoComment) => void;
}

function CommentCard({ comment, currentUid, onDeleted, onEdited }: CommentCardProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [loading, setLoading] = useState(false);

	const isOwner = !!currentUid && currentUid === comment.authorUid;

	const handleEdit = useCallback(async () => {
		if (!editContent.trim()) return;
		setLoading(true);
		try {
			const token = await clientAuth.currentUser?.getIdToken();
			if (!token) throw new Error('Unauthorized');
			const res = await fetch(`/api/v2/posts/${comment.postId}/comments/${comment.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ content: editContent.trim() })
			});
			if (!res.ok) throw new Error('Failed to update comment');
			const { comment: updated } = (await res.json()) as { comment: DemoComment };
			onEdited({ ...updated, createdAt: new Date(updated.createdAt), updatedAt: new Date(updated.updatedAt) });
			setIsEditing(false);
		} catch {
			// ignore — keep editing state open
		} finally {
			setLoading(false);
		}
	}, [comment, editContent, onEdited]);

	const handleDelete = useCallback(async () => {
		setLoading(true);
		try {
			const token = await clientAuth.currentUser?.getIdToken();
			if (!token) throw new Error('Unauthorized');
			const res = await fetch(`/api/v2/posts/${comment.postId}/comments/${comment.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) throw new Error('Failed to delete comment');
			onDeleted(comment.id);
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, [comment, onDeleted]);

	return (
		<div className='flex w-full items-start gap-x-3'>
			{/* Avatar */}
			<div className='shrink-0'>
				<Image
					src={UserIcon}
					alt='profile'
					className='h-[30px] w-[30px] rounded-full'
				/>
			</div>

			{/* Body */}
			<div className='flex w-full min-w-0 flex-col gap-y-1'>
				{/* Header: name + date */}
				<div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
					<span className='text-sm font-semibold text-text_primary'>{comment.authorDisplayName}</span>
					<Separator
						orientation='vertical'
						className='h-3'
					/>
					<span className='text-xs text-wallet_btn_text'>{dayjs(comment.createdAt).fromNow()}</span>
				</div>

				{/* Content */}
				{isEditing ? (
					<div className='flex flex-col gap-y-2'>
						<textarea
							className='w-full rounded-md border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary outline-none focus:ring-1 focus:ring-text_pink'
							rows={3}
							value={editContent}
							onChange={(e) => setEditContent(e.target.value)}
							disabled={loading}
						/>
						<div className='flex items-center justify-end gap-x-2'>
							<Button
								variant='secondary'
								size='sm'
								onClick={() => {
									setIsEditing(false);
									setEditContent(comment.content);
								}}
								disabled={loading}
							>
								Cancel
							</Button>
							<Button
								size='sm'
								onClick={handleEdit}
								disabled={!editContent.trim() || loading}
								isLoading={loading}
							>
								Save
							</Button>
						</div>
					</div>
				) : (
					<p className='whitespace-pre-wrap break-words text-sm text-wallet_btn_text'>{comment.content}</p>
				)}

				{/* Actions row */}
				{!isEditing && isOwner && (
					<div className='flex items-center'>
						<div className='ml-auto'>
							<DropdownMenu>
								<DropdownMenuTrigger
									noArrow
									className='border-none'
								>
									<Ellipsis
										className='text-text_primary/[0.8]'
										size={14}
									/>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuItem className='hover:bg-bg_pink/10'>
										<Button
											variant='ghost'
											className='h-auto p-0 text-sm text-text_primary'
											size='sm'
											onClick={() => setIsEditing(true)}
											disabled={loading}
										>
											Edit
										</Button>
									</DropdownMenuItem>
									<DropdownMenuItem className='hover:bg-bg_pink/10'>
										<Button
											variant='ghost'
											className='h-auto p-0 text-sm text-text_primary'
											size='sm'
											onClick={handleDelete}
											isLoading={loading}
										>
											Delete
										</Button>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Comment input form
// ---------------------------------------------------------------------------

interface CommentInputProps {
	postId: string;
	onCommentAdded: (comment: DemoComment) => void;
}

function CommentInput({ postId, onCommentAdded }: CommentInputProps) {
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSubmit = useCallback(async () => {
		if (!content.trim()) return;
		setLoading(true);
		try {
			const token = await clientAuth.currentUser?.getIdToken();
			if (!token) throw new Error('Unauthorized');
			const res = await fetch(`/api/v2/posts/${postId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ content: content.trim() })
			});
			if (!res.ok) throw new Error('Failed to add comment');
			const { comment } = (await res.json()) as { comment: DemoComment };
			onCommentAdded({ ...comment, createdAt: new Date(comment.createdAt), updatedAt: new Date(comment.updatedAt) });
			setContent('');
			if (textareaRef.current) textareaRef.current.style.height = 'auto';
		} catch {
			// keep form open on error
		} finally {
			setLoading(false);
		}
	}, [content, postId, onCommentAdded]);

	// Auto-resize textarea
	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setContent(e.target.value);
		e.target.style.height = 'auto';
		e.target.style.height = `${e.target.scrollHeight}px`;
	};

	return (
		<div className='flex flex-col gap-y-3'>
			<textarea
				ref={textareaRef}
				className='w-full resize-none overflow-hidden rounded-md border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary outline-none focus:ring-1 focus:ring-text_pink'
				rows={3}
				placeholder='Write a comment...'
				value={content}
				onChange={handleChange}
				disabled={loading}
			/>
			<div className='flex justify-end'>
				<Button
					onClick={handleSubmit}
					disabled={!content.trim()}
					isLoading={loading}
				>
					Post
				</Button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main DemoCommentSection
// ---------------------------------------------------------------------------

function DemoCommentSection({ postId }: DemoCommentSectionProps) {
	const { user, loading: authLoading } = useDemoUser();
	const [comments, setComments] = useState<DemoComment[]>([]);
	const [fetchLoading, setFetchLoading] = useState(true);
	const [fetchError, setFetchError] = useState<string | null>(null);

	// Fetch comments on mount
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`/api/v2/posts/${postId}/comments`);
				if (!res.ok) throw new Error('Failed to fetch comments');
				const { comments: fetched } = (await res.json()) as { comments: DemoComment[] };
				if (!cancelled) {
					setComments(
						fetched.map((c) => ({
							...c,
							createdAt: new Date(c.createdAt),
							updatedAt: new Date(c.updatedAt)
						}))
					);
				}
			} catch (err) {
				if (!cancelled) setFetchError((err as Error).message);
			} finally {
				if (!cancelled) setFetchLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [postId]);

	const handleCommentAdded = useCallback((comment: DemoComment) => {
		setComments((prev) => [...prev, comment]);
	}, []);

	const handleCommentDeleted = useCallback((id: string) => {
		setComments((prev) => prev.filter((c) => c.id !== id));
	}, []);

	const handleCommentEdited = useCallback((updated: DemoComment) => {
		setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
	}, []);

	return (
		<div className='mt-6'>
			{/* Section header */}
			<div className='mb-4 flex items-center gap-x-2 px-6'>
				<MessageSquare
					className='text-text_primary'
					size={20}
				/>
				<p className='text-xl font-semibold text-text_primary'>
					Comments{' '}
					<span className='text-base font-normal'>
						{fetchLoading ? '' : `(${comments.length})`}
					</span>
				</p>
			</div>

			{/* Comments list */}
			<div className='flex flex-col gap-y-4 px-6'>
				{fetchLoading ? (
					<>
						<div className='flex items-start gap-x-3'>
							<Skeleton className='h-[30px] w-[30px] rounded-full' />
							<div className='flex flex-1 flex-col gap-y-1'>
								<Skeleton className='h-4 w-32' />
								<Skeleton className='h-3 w-full' />
								<Skeleton className='h-3 w-4/5' />
							</div>
						</div>
						<div className='flex items-start gap-x-3'>
							<Skeleton className='h-[30px] w-[30px] rounded-full' />
							<div className='flex flex-1 flex-col gap-y-1'>
								<Skeleton className='h-4 w-40' />
								<Skeleton className='h-3 w-full' />
							</div>
						</div>
					</>
				) : fetchError ? (
					<p className='text-sm text-red-500'>{fetchError}</p>
				) : comments.length === 0 ? (
					<p className='text-sm text-wallet_btn_text'>No comments yet. Be the first to comment!</p>
				) : (
					comments.map((comment) => (
						<CommentCard
							key={comment.id}
							comment={comment}
							currentUid={user?.uid ?? null}
							onDeleted={handleCommentDeleted}
							onEdited={handleCommentEdited}
						/>
					))
				)}
			</div>

			<Separator className='my-6' />

			{/* Add comment form */}
			<div className='px-6 pb-6'>
				{authLoading ? (
					<Skeleton className='h-24 w-full' />
				) : user ? (
					<CommentInput
						postId={postId}
						onCommentAdded={handleCommentAdded}
					/>
				) : (
					<p className='text-sm text-text_primary'>
						Please{' '}
						<Link
							href='/login'
							className='text-text_pink hover:underline'
						>
							log in
						</Link>{' '}
						to leave a comment.
					</p>
				)}
			</div>
		</div>
	);
}

export default DemoCommentSection;
