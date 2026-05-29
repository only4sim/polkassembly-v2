// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import Link from 'next/link';
import Identicon from '@polkadot/react-identicon';
import { CornerUpLeft, Ellipsis } from 'lucide-react';
import { type MDXEditorMethods } from '@mdxeditor/editor';
import { FiArrowDownCircle } from '@react-icons/all-files/fi/FiArrowDownCircle';
import { FiArrowUpCircle } from '@react-icons/all-files/fi/FiArrowUpCircle';
import { DemoComment } from '@/domain/entities/Comment';
import { useDemoUser } from '@/hooks/useDemoUser';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { ENotificationStatus, EReaction } from '@/_shared/types';
import { Button } from '@ui/Button';
import { Skeleton } from '@ui/Skeleton';
import { Separator } from '@ui/Separator';
import { MarkdownViewer } from '@ui/MarkdownViewer/MarkdownViewer';
import { MarkdownEditor } from '@ui/MarkdownEditor/MarkdownEditor';
import CreatedAtTime from '@ui/CreatedAtTime/CreatedAtTime';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ui/DropdownMenu';
import ReactionButton from '@/app/(home)/activity-feed/Components/ReactionButton/ReactionButton';
import { useToast } from '@/hooks/useToast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseComment(c: DemoComment): DemoComment {
	return {
		...c,
		createdAt: c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt),
		updatedAt: c.updatedAt instanceof Date ? c.updatedAt : new Date(c.updatedAt)
	};
}

// ---------------------------------------------------------------------------
// DemoAddComment — markdown-editor-based comment input
// ---------------------------------------------------------------------------

interface DemoAddCommentProps {
	postId: string;
	parentCommentId?: string;
	onCommentAdded: (comment: DemoComment) => void;
	onCancel?: () => void;
	isReply?: boolean;
}

function DemoAddComment({ postId, parentCommentId, onCommentAdded, onCancel, isReply }: DemoAddCommentProps) {
	const { user } = useDemoUser();
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(false);
	const editorRef = useRef<MDXEditorMethods | null>(null);
	const { toast } = useToast();

	const handleSubmit = useCallback(async () => {
		if (!content.trim()) return;
		setLoading(true);
		try {
			const token = await clientAuth.currentUser?.getIdToken();
			if (!token) throw new Error('Unauthorized');
			const res = await fetch(`/api/v2/posts/${postId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ content: content.trim(), parentCommentId })
			});
			if (!res.ok) throw new Error('Failed to add comment');
			const { comment } = (await res.json()) as { comment: DemoComment };
			onCommentAdded(parseComment(comment));
			setContent('');
			editorRef.current?.setMarkdown('');
			onCancel?.();
		} catch (err) {
			toast({ title: 'Failed to add comment', description: (err as Error).message, status: ENotificationStatus.ERROR });
		} finally {
			setLoading(false);
		}
	}, [content, postId, parentCommentId, onCommentAdded, onCancel, toast]);

	return (
		<div className='flex flex-col gap-y-3'>
			{!isReply && user && (
				<div className='flex items-center gap-x-2 rounded-md bg-page_background px-3 py-2'>
					<Identicon
						size={20}
						value={user.uid}
						theme='polkadot'
					/>
					<span className='text-sm font-medium text-text_primary'>{user.displayName ?? user.email ?? 'You'}</span>
				</div>
			)}
			<MarkdownEditor
				ref={editorRef}
				markdown={content}
				onChange={(val) => setContent(val)}
			/>
			<div className='flex items-center justify-end gap-x-2'>
				{onCancel && (
					<Button
						variant='secondary'
						size='sm'
						onClick={onCancel}
						disabled={loading}
					>
						Cancel
					</Button>
				)}
				<Button
					onClick={handleSubmit}
					disabled={!content.trim()}
					isLoading={loading}
					className='bg-wallet_btn_text/[0.6] px-6 hover:bg-wallet_btn_text'
				>
					Post
				</Button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// DemoSingleComment — one comment row with reactions, reply, edit/delete
// ---------------------------------------------------------------------------

interface DemoSingleCommentProps {
	comment: DemoComment;
	replies?: DemoComment[];
	currentUid: string | null;
	postId: string;
	isReply?: boolean;
	onDeleted: (id: string) => void;
	onEdited: (updated: DemoComment) => void;
	onReacted: (commentId: string, updatedReactions: Record<string, 'like' | 'dislike'>) => void;
	onReplyAdded: (reply: DemoComment) => void;
}

const DemoSingleComment = memo(function DemoSingleComment({ comment, replies, currentUid, postId, isReply, onDeleted, onEdited, onReacted, onReplyAdded }: DemoSingleCommentProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [loading, setLoading] = useState(false);
	const [showReplyBox, setShowReplyBox] = useState(false);
	const [showAllReplies, setShowAllReplies] = useState(false);
	const { toast } = useToast();

	const isOwner = !!currentUid && currentUid === comment.authorUid;

	// Compute reaction counts from the reactions map
	const reactions = comment.reactions ?? {};
	const likesCount = Object.values(reactions).filter((r) => r === 'like').length;
	const dislikesCount = Object.values(reactions).filter((r) => r === 'dislike').length;
	const currentReaction = currentUid ? reactions[currentUid] : undefined;

	const handleReaction = useCallback(
		async (reaction: 'like' | 'dislike') => {
			if (!currentUid) return;
			try {
				const token = await clientAuth.currentUser?.getIdToken();
				if (!token) return;
				const res = await fetch(`/api/v2/posts/${postId}/comments/${comment.id}/reactions`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ reaction })
				});
				if (!res.ok) throw new Error('Failed to react');
				const { reactions: updated } = (await res.json()) as { reactions: Record<string, 'like' | 'dislike'> };
				onReacted(comment.id, updated);
			} catch {
				// ignore — reaction is non-critical
			}
		},
		[comment.id, currentUid, postId, onReacted]
	);

	const handleEdit = useCallback(async () => {
		if (!editContent.trim()) return;
		setLoading(true);
		try {
			const token = await clientAuth.currentUser?.getIdToken();
			if (!token) throw new Error('Unauthorized');
			const res = await fetch(`/api/v2/posts/${postId}/comments/${comment.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ content: editContent.trim() })
			});
			if (!res.ok) throw new Error('Failed to update comment');
			const { comment: updated } = (await res.json()) as { comment: DemoComment };
			onEdited(parseComment(updated));
			setIsEditing(false);
			toast({ title: 'Comment updated', status: ENotificationStatus.SUCCESS });
		} catch (err) {
			toast({ title: 'Failed to update', description: (err as Error).message, status: ENotificationStatus.ERROR });
		} finally {
			setLoading(false);
		}
	}, [comment.id, editContent, postId, onEdited, toast]);

	const handleDelete = useCallback(async () => {
		setLoading(true);
		try {
			const token = await clientAuth.currentUser?.getIdToken();
			if (!token) throw new Error('Unauthorized');
			const res = await fetch(`/api/v2/posts/${postId}/comments/${comment.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) throw new Error('Failed to delete comment');
			onDeleted(comment.id);
			toast({ title: 'Comment deleted', status: ENotificationStatus.SUCCESS });
		} catch (err) {
			toast({ title: 'Failed to delete', description: (err as Error).message, status: ENotificationStatus.ERROR });
		} finally {
			setLoading(false);
		}
	}, [comment.id, postId, onDeleted, toast]);

	const handleCopyLink = useCallback(() => {
		const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
		navigator.clipboard.writeText(url).catch(() => null);
		toast({ title: 'Link copied to clipboard', status: ENotificationStatus.SUCCESS });
	}, [comment.id, toast]);

	const visibleReplies = showAllReplies ? (replies ?? []) : (replies ?? []).slice(0, 1);
	const hiddenRepliesCount = Math.max(0, (replies?.length ?? 0) - 1);

	return (
		<div
			id={`comment-${comment.id}`}
			className='flex w-full items-start gap-x-3'
		>
			{/* Identicon avatar */}
			<div className='shrink-0 pt-0.5'>
				<Identicon
					size={30}
					value={comment.authorUid}
					theme='polkadot'
				/>
			</div>

			{/* Body */}
			<div className='flex w-full min-w-0 flex-col gap-y-1'>
				{/* Header: name | timestamp */}
				<div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
					<span className='text-sm font-semibold text-text_primary'>{comment.authorDisplayName}</span>
					<Separator
						orientation='vertical'
						className='h-3'
					/>
					<CreatedAtTime createdAt={comment.updatedAt || comment.createdAt} />
				</div>

				{/* Content */}
				{isEditing ? (
					<div className='flex flex-col gap-y-2'>
						<MarkdownEditor
							markdown={editContent}
							onChange={(val) => setEditContent(val)}
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
					<MarkdownViewer
						markdown={comment.content}
						className='border-none text-wallet_btn_text'
					/>
				)}

				{/* Actions toolbar */}
				{!isEditing && (
					<div className='mt-1 flex w-full items-center gap-x-3'>
						{/* Like */}
						<div className={`flex cursor-pointer items-center gap-1 transition-colors ${currentReaction === 'like' ? 'text-bg_pink' : 'text-basic_text'}`}>
							<ReactionButton
								type={EReaction.like}
								isActive={currentReaction === 'like'}
								showText={false}
								className='h-4 w-4'
								count={likesCount}
								onClick={() => handleReaction('like')}
								disabled={!currentUid}
							/>
						</div>

						{/* Dislike */}
						<div className={`flex cursor-pointer items-center gap-1 transition-colors ${currentReaction === 'dislike' ? 'text-bg_pink' : 'text-basic_text'}`}>
							<ReactionButton
								type={EReaction.dislike}
								isActive={currentReaction === 'dislike'}
								showText={false}
								className='h-4 w-4'
								count={dislikesCount}
								onClick={() => handleReaction('dislike')}
								disabled={!currentUid}
							/>
						</div>

						{/* Reply */}
						{!isReply &&
							(currentUid ? (
								<Button
									variant='ghost'
									size='sm'
									className='gap-1 p-0 text-xs text-wallet_btn_text'
									leftIcon={<CornerUpLeft size={12} />}
									onClick={() => setShowReplyBox((prev) => !prev)}
								>
									Reply
								</Button>
							) : (
								<Link href='/login'>
									<Button
										variant='ghost'
										size='sm'
										className='gap-1 p-0 text-xs text-wallet_btn_text'
										leftIcon={<CornerUpLeft size={12} />}
									>
										Reply
									</Button>
								</Link>
							))}

						{/* More options */}
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
									<DropdownMenuItem>
										<Button
											variant='ghost'
											className='h-auto w-full p-0 text-left text-sm text-text_primary'
											size='sm'
											onClick={handleCopyLink}
										>
											Copy Link
										</Button>
									</DropdownMenuItem>
									{isOwner && (
										<>
											<DropdownMenuItem>
												<Button
													variant='ghost'
													className='h-auto w-full p-0 text-left text-sm text-text_primary'
													size='sm'
													onClick={() => setIsEditing(true)}
													disabled={loading}
												>
													Edit
												</Button>
											</DropdownMenuItem>
											<DropdownMenuItem>
												<Button
													variant='ghost'
													className='h-auto w-full p-0 text-left text-sm text-text_primary'
													size='sm'
													onClick={handleDelete}
													isLoading={loading}
												>
													Delete
												</Button>
											</DropdownMenuItem>
										</>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				)}

				{/* Inline reply input */}
				{showReplyBox && (
					<div className='mt-3'>
						<DemoAddComment
							postId={postId}
							parentCommentId={comment.id}
							isReply
							onCommentAdded={(reply) => {
								onReplyAdded(reply);
								setShowReplyBox(false);
								setShowAllReplies(true);
							}}
							onCancel={() => setShowReplyBox(false)}
						/>
					</div>
				)}

				{/* Replies — only one level of nesting is supported */}
				{!isReply && (replies?.length ?? 0) > 0 && (
					<div className='mt-3 flex flex-col gap-y-3 border-l border-border_grey pl-4'>
						{visibleReplies.map((reply) => (
							<DemoSingleComment
								key={reply.id}
								comment={reply}
								currentUid={currentUid}
								postId={postId}
								isReply
								onDeleted={onDeleted}
								onEdited={onEdited}
								onReacted={onReacted}
								onReplyAdded={onReplyAdded}
							/>
						))}

						{/* Toggle remaining replies */}
						{hiddenRepliesCount > 0 && (
							<div className='flex items-center gap-x-2'>
								<Button
									variant='ghost'
									size='sm'
									className='p-0 text-xs text-small_btn_text'
									onClick={() => setShowAllReplies((prev) => !prev)}
								>
									{showAllReplies ? 'Hide replies' : `View replies (${hiddenRepliesCount})`}
								</Button>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
});

// ---------------------------------------------------------------------------
// DemoCommentSection — main section
// ---------------------------------------------------------------------------

const INITIAL_VISIBLE = 2;

interface DemoCommentSectionProps {
	postId: string;
}

function DemoCommentSection({ postId }: DemoCommentSectionProps) {
	const { user, loading: authLoading } = useDemoUser();
	const [comments, setComments] = useState<DemoComment[]>([]);
	const [fetchLoading, setFetchLoading] = useState(true);
	const [fetchError, setFetchError] = useState<string | null>(null);
	const [showAll, setShowAll] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`/api/v2/posts/${postId}/comments`);
				if (!res.ok) throw new Error('Failed to fetch comments');
				const { comments: fetched } = (await res.json()) as { comments: DemoComment[] };
				if (!cancelled) setComments(fetched.map(parseComment));
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

	// Group: top-level comments + replies map
	const topLevelComments = comments.filter((c) => !c.parentCommentId);
	const repliesMap = comments.reduce<Record<string, DemoComment[]>>((acc, c) => {
		if (c.parentCommentId) {
			if (!acc[c.parentCommentId]) acc[c.parentCommentId] = [];
			acc[c.parentCommentId].push(c);
		}
		return acc;
	}, {});

	const visibleComments = showAll ? topLevelComments : topLevelComments.slice(0, INITIAL_VISIBLE);
	const hiddenCount = topLevelComments.length - INITIAL_VISIBLE;

	const handleCommentAdded = useCallback((comment: DemoComment) => {
		setComments((prev) => [...prev, comment]);
		// Automatically expand when the user adds a top-level comment
		if (!comment.parentCommentId) setShowAll(true);
	}, []);

	const handleCommentDeleted = useCallback((id: string) => {
		setComments((prev) => prev.filter((c) => c.id !== id));
	}, []);

	const handleCommentEdited = useCallback((updated: DemoComment) => {
		setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
	}, []);

	const handleReacted = useCallback((commentId: string, updatedReactions: Record<string, 'like' | 'dislike'>) => {
		setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, reactions: updatedReactions } : c)));
	}, []);

	return (
		<div className='pt-6'>
			{/* Section header */}
			<div className='mb-4 flex items-center gap-x-2 px-6'>
				<p className='text-xl font-semibold text-text_primary'>Comments {!fetchLoading && <span className='text-base font-normal'>({topLevelComments.length})</span>}</p>
			</div>

			{/* Comments list */}
			<div className='flex flex-col gap-y-6 px-4 lg:px-6'>
				{fetchLoading ? (
					<>
						{[1, 2].map((i) => (
							<div
								key={i}
								className='flex items-start gap-x-3'
							>
								<Skeleton className='h-[30px] w-[30px] shrink-0 rounded-full' />
								<div className='flex flex-1 flex-col gap-y-2'>
									<Skeleton className='h-4 w-40' />
									<Skeleton className='h-3 w-full' />
									<Skeleton className='h-3 w-4/5' />
								</div>
							</div>
						))}
					</>
				) : fetchError ? (
					<p className='text-sm text-red-500'>{fetchError}</p>
				) : topLevelComments.length === 0 ? (
					<p className='text-sm text-wallet_btn_text'>No comments yet. Be the first to comment!</p>
				) : (
					visibleComments.map((comment) => (
						<DemoSingleComment
							key={comment.id}
							comment={comment}
							replies={repliesMap[comment.id]}
							currentUid={user?.uid ?? null}
							postId={postId}
							onDeleted={handleCommentDeleted}
							onEdited={handleCommentEdited}
							onReacted={handleReacted}
							onReplyAdded={handleCommentAdded}
						/>
					))
				)}

				{/* Load more / Show less */}
				{!fetchLoading && topLevelComments.length > INITIAL_VISIBLE && (
					<div className='flex justify-center'>
						{showAll ? (
							<button
								type='button'
								onClick={() => setShowAll(false)}
								className='flex cursor-pointer items-center gap-1 rounded-full bg-page_background px-3 py-1.5 text-sm font-medium text-text_primary'
							>
								Show less <FiArrowUpCircle className='text-lg' />
							</button>
						) : (
							<button
								type='button'
								onClick={() => setShowAll(true)}
								className='flex cursor-pointer items-center gap-1 rounded-full bg-page_background px-3 py-1.5 text-sm font-medium text-text_primary'
							>
								Load more comments ({hiddenCount}) <FiArrowDownCircle className='text-lg' />
							</button>
						)}
					</div>
				)}
			</div>

			<Separator className='my-6' />

			{/* Add comment */}
			<div className='px-6 pb-6'>
				{authLoading ? (
					<Skeleton className='h-32 w-full' />
				) : user ? (
					<DemoAddComment
						postId={postId}
						onCommentAdded={handleCommentAdded}
					/>
				) : (
					<div className='flex w-full items-center justify-center gap-x-1 rounded-lg bg-address_input_bg p-4 text-text_primary shadow-md'>
						Please{' '}
						<Link
							href='/login'
							className='text-text_pink hover:underline'
						>
							log in
						</Link>{' '}
						to leave a comment.
					</div>
				)}
			</div>
		</div>
	);
}

export default DemoCommentSection;
