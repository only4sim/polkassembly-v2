// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import Link from 'next/link';
import { DemoPost } from '@/domain/entities/Post';
import { ArrowLeftIcon, Share2 } from 'lucide-react';
import { Separator } from '@ui/Separator';
import dynamic from 'next/dynamic';
import { Skeleton } from '@ui/Skeleton';
import Identicon from '@polkadot/react-identicon';
import CreatedAtTime from '@ui/CreatedAtTime/CreatedAtTime';
import { ENotificationStatus, EReaction } from '@/_shared/types';
import ReactionButton from '@/app/(home)/activity-feed/Components/ReactionButton/ReactionButton';
import { IoBookmark } from '@react-icons/all-files/io5/IoBookmark';
import { IoBookmarkOutline } from '@react-icons/all-files/io5/IoBookmarkOutline';
import { FiChevronDown } from '@react-icons/all-files/fi/FiChevronDown';
import { FiChevronUp } from '@react-icons/all-files/fi/FiChevronUp';
import { useCallback, useEffect, useState } from 'react';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import { useDemoUser } from '@/hooks/useDemoUser';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import DemoCommentSection from './DemoCommentSection';
import DemoVoteSection from './DemoVoteSection';

// MarkdownViewer is dynamically loaded to avoid SSR hydration issues
const MarkdownViewer = dynamic(() => import('@ui/MarkdownViewer/MarkdownViewer').then((m) => m.MarkdownViewer), {
	ssr: false,
	loading: () => (
		<div className='flex flex-col gap-2'>
			<Skeleton className='h-4 w-full' />
			<Skeleton className='h-4 w-5/6' />
			<Skeleton className='h-4 w-4/6' />
		</div>
	)
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a human-readable topic label. */
function formatTopic(topic: string): string {
	return topic.charAt(0).toUpperCase() + topic.slice(1).replace(/([A-Z])/g, ' $1');
}

function getTopicStyle(topic: string): string {
	switch (topic) {
		case 'governance':
			return 'bg-[#EEF0FB] text-[#5B46D9]';
		case 'treasury':
			return 'bg-[#E0F4EC] text-[#2EA86A]';
		case 'technicalCommittee':
			return 'bg-[#FFF3E0] text-[#D4820A]';
		case 'democracy':
			return 'bg-[#FDE8F5] text-[#C4247A]';
		default:
			return 'bg-[#ECF1FF] text-[#4F6CF0]';
	}
}

const SHOW_MORE_THRESHOLD = 400; // px — collapse body beyond this height

// ---------------------------------------------------------------------------
// DemoPostBody — collapsible content + action bar
// ---------------------------------------------------------------------------

interface DemoPostBodyProps {
	post: DemoPost;
}

function DemoPostBody({ post }: DemoPostBodyProps) {
	const { user } = useDemoUser();
	const { toast } = useToast();

	// Reactions state
	const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>(post.reactions ?? {});
	const currentReaction = user ? reactions[user.uid] : undefined;
	const likesCount = Object.values(reactions).filter((r) => r === 'like').length;
	const dislikesCount = Object.values(reactions).filter((r) => r === 'dislike').length;

	// Bookmark state (localStorage-persisted)
	const [isBookmarked, setIsBookmarked] = useState(false);
	useEffect(() => {
		try {
			const saved = localStorage.getItem(`demo-bookmark-${post.id}`);
			setIsBookmarked(saved === 'true');
		} catch {
			// ignore
		}
	}, [post.id]);

	// Show more / less state
	const [isExpanded, setIsExpanded] = useState(false);
	const [contentTall, setContentTall] = useState(false);
	const contentRef = useCallback((node: HTMLDivElement | null) => {
		if (node) setContentTall(node.scrollHeight > SHOW_MORE_THRESHOLD);
	}, []);

	const handleReaction = useCallback(
		async (reaction: 'like' | 'dislike') => {
			if (!user) {
				toast({ title: 'Please log in to react', status: ENotificationStatus.INFO });
				return;
			}
			try {
				const token = await clientAuth.currentUser?.getIdToken();
				if (!token) return;
				const res = await fetch(`/api/v2/posts/${post.id}/reactions`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ reaction })
				});
				if (!res.ok) throw new Error('Failed to react');
				const { reactions: updated } = (await res.json()) as { reactions: Record<string, 'like' | 'dislike'> };
				setReactions(updated);
			} catch {
				// non-critical — silently ignore
			}
		},
		[post.id, user, toast]
	);

	const handleBookmark = useCallback(() => {
		const next = !isBookmarked;
		setIsBookmarked(next);
		try {
			localStorage.setItem(`demo-bookmark-${post.id}`, next ? 'true' : 'false');
		} catch {
			// ignore
		}
		toast({ title: next ? 'Bookmarked' : 'Bookmark removed', status: ENotificationStatus.SUCCESS });
	}, [isBookmarked, post.id, toast]);

	const handleShare = useCallback(() => {
		navigator.clipboard.writeText(window.location.href).catch(() => null);
		toast({ title: 'Link copied to clipboard', status: ENotificationStatus.SUCCESS });
	}, [toast]);

	return (
		<div className='rounded-xl border border-primary_border bg-bg_modal'>
			{/* Collapsible body */}
			<div className='relative p-4 lg:p-6'>
				<div
					ref={contentRef}
					className={cn('overflow-hidden transition-all duration-300', !isExpanded && contentTall ? 'max-h-[400px]' : 'max-h-none')}
				>
					<MarkdownViewer markdown={post.content} />
				</div>

				{/* Gradient fade + Show More */}
				{contentTall && !isExpanded && <div className='absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-bg_modal to-transparent' />}
			</div>

			{contentTall && (
				<div className='flex justify-center pb-3'>
					<button
						type='button'
						onClick={() => setIsExpanded((prev) => !prev)}
						className='flex items-center gap-1 text-sm font-medium text-text_primary hover:text-text_pink'
					>
						{isExpanded ? (
							<>
								Show Less <FiChevronUp className='text-base' />
							</>
						) : (
							<>
								Show More <FiChevronDown className='text-base' />
							</>
						)}
					</button>
				</div>
			)}

			<Separator />

			{/* Action bar */}
			<div className='flex w-full items-center justify-between px-4 py-3 lg:px-6'>
				<div className='flex items-center gap-3'>
					{/* Like */}
					<div className={cn('flex cursor-pointer items-center gap-1 rounded-md bg-grey_bg p-1.5', currentReaction === 'like' ? 'text-bg_pink' : 'text-basic_text')}>
						<ReactionButton
							type={EReaction.like}
							isActive={currentReaction === 'like'}
							showText={false}
							className='text-sm'
							count={likesCount}
							onClick={() => handleReaction('like')}
						/>
					</div>
					{/* Dislike */}
					<div className={cn('flex cursor-pointer items-center gap-1 rounded-md bg-grey_bg p-1.5', currentReaction === 'dislike' ? 'text-bg_pink' : 'text-basic_text')}>
						<ReactionButton
							type={EReaction.dislike}
							isActive={currentReaction === 'dislike'}
							showText={false}
							className='text-sm'
							count={dislikesCount}
							onClick={() => handleReaction('dislike')}
						/>
					</div>
				</div>

				<div className='flex items-center gap-3 text-basic_text'>
					{/* Bookmark */}
					<button
						type='button'
						onClick={handleBookmark}
						className='flex cursor-pointer items-center gap-1 rounded-md bg-grey_bg p-1.5 hover:text-bg_pink'
					>
						{isBookmarked ? <IoBookmark className='h-4 w-4 text-bg_pink' /> : <IoBookmarkOutline className='h-4 w-4' />}
					</button>
					{/* Share */}
					<button
						type='button'
						onClick={handleShare}
						className='flex cursor-pointer items-center gap-1 rounded-md bg-grey_bg p-1.5 hover:text-bg_pink'
					>
						<Share2 className='h-4 w-4' />
					</button>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// DemoPostDetail
// ---------------------------------------------------------------------------

interface DemoPostDetailProps {
	post: DemoPost;
}

function DemoPostDetail({ post }: DemoPostDetailProps) {
	const createdAt = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt);

	return (
		<div>
			{/* Sticky header */}
			<div className='sticky top-12 z-20 w-full bg-bg_modal px-4 pt-6 shadow-lg lg:px-16'>
				{/* Breadcrumb */}
				<div className='mb-4 flex items-center gap-x-1 px-0'>
					<ArrowLeftIcon className='h-3 w-4' />
					<Link
						href='/discussions'
						className='flex items-center gap-x-1 text-xs text-listing_page_btn hover:underline'
					>
						View All Discussions
					</Link>
				</div>

				{/* Title + meta */}
				<div className='mb-4'>
					<p className='text-xl font-bold text-text_primary lg:text-2xl'>{post.title}</p>
					<div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-2'>
						{/* Identicon avatar */}
						<Identicon
							size={20}
							value={post.authorUid || post.authorName}
							theme='polkadot'
						/>
						<span className='text-sm font-medium text-text_primary'>{post.authorName}</span>

						<Separator
							orientation='vertical'
							className='h-3'
						/>
						<CreatedAtTime createdAt={createdAt} />

						{post.topic && (
							<>
								<Separator
									orientation='vertical'
									className='h-3'
								/>
								<span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${getTopicStyle(post.topic)}`}>{formatTopic(post.topic)}</span>
							</>
						)}

						{post.tags && post.tags.length > 0 && (
							<>
								<Separator
									orientation='vertical'
									className='h-3'
								/>
								<div className='flex flex-wrap gap-1'>
									{post.tags.map((tag) => (
										<span
											key={tag}
											className='rounded-full border border-border_grey px-2 py-0.5 text-[10px] text-wallet_btn_text'
										>
											{tag}
										</span>
									))}
								</div>
							</>
						)}
					</div>
				</div>

				{/* Tab bar */}
				<div className='flex items-center gap-1 overflow-x-auto py-2'>
					<button
						type='button'
						className='flex-shrink-0 border-b-2 border-text_pink px-1 py-1 text-[11px] font-bold text-text_pink sm:px-3 sm:py-2 sm:text-sm'
					>
						Description
					</button>
				</div>
			</div>

			{/* Main content */}
			<div className='mx-auto max-w-7xl px-4 py-6 lg:px-16'>
				<DemoPostBody post={post} />

				{/* Poll / Vote section */}
				{post.poll && (
					<DemoVoteSection
						postId={post.id}
						poll={post.poll}
					/>
				)}

				{/* Comments */}
				<div className='mt-6 rounded-xl border border-primary_border bg-bg_modal'>
					<DemoCommentSection postId={post.id} />
				</div>
			</div>
		</div>
	);
}

export default DemoPostDetail;
