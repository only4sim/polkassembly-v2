// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ellipsis, Link, Pencil, Trash2 } from 'lucide-react';
import { ENotificationStatus, IPost } from '@/_shared/types';
import { useUser } from '@/hooks/useUser';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/useToast';
import { NextApiClientService } from '@/app/_client-services/next_api_client_service';
import { ValidatorService } from '@/_shared/_services/validator_service';
import { getPostListingUrl } from '@/app/_client-utils/getPostListingUrl';
import { getSubstrateAddress } from '@/_shared/_utils/getSubstrateAddress';
import { OFF_CHAIN_PROPOSAL_TYPES } from '@/_shared/_constants/offChainProposalTypes';
import { Button } from '../Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../Dialog/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../DropdownMenu';
import EditPost from './EditPost/EditPost';
import LinkDiscussionPost from './LinkDiscussionPost/LinkDiscussionPost';

function PostActionsMenu({ postData }: { postData: IPost }) {
	const { user } = useUser();
	const t = useTranslations();
	const router = useRouter();
	const { toast } = useToast();

	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [isLinkOpen, setIsLinkOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const deleteLabel = t('PostDetails.delete');

	const proposerAddress = postData.onChainInfo?.proposer && getSubstrateAddress(postData.onChainInfo.proposer);
	const canEditOffChain = user && user.id === postData.userId;
	const canEditOnChain = user && proposerAddress && user.addresses.includes(proposerAddress);

	const canEditSignatories = useMemo(() => {
		return (
			proposerAddress &&
			user?.addressRelations?.some((relation) =>
				relation.multisigAddresses.some(
					(multisig) => getSubstrateAddress(multisig.address) === proposerAddress || multisig.pureProxies.some((proxy) => getSubstrateAddress(proxy.address) === proposerAddress)
				)
			)
		);
	}, [proposerAddress, user?.addressRelations]);

	const canEditProxy = useMemo(() => {
		return proposerAddress && user?.addressRelations?.some((relation) => relation.proxyAddresses.some((proxy) => getSubstrateAddress(proxy.address) === proposerAddress));
	}, [proposerAddress, user?.addressRelations]);

	const canEdit = canEditOffChain || canEditOnChain || canEditSignatories || canEditProxy;
	const canDelete = Boolean(user?.id && user.id === postData.userId && ValidatorService.isValidNumber(postData.index));
	const canLink =
		(user && proposerAddress && user.addresses.includes(proposerAddress) && !OFF_CHAIN_PROPOSAL_TYPES.includes(postData.proposalType)) || canEditSignatories || canEditProxy;

	if (!canEdit && !canDelete && !canLink) return null;

	const handleDelete = async () => {
		if (!postData.index) return;

		setIsDeleting(true);
		try {
			const { data, error } = await NextApiClientService.deleteProposalDetails({
				proposalType: postData.proposalType,
				index: postData.index.toString()
			});

			if (error || !data) {
				throw new Error(error?.message || 'Failed to delete post');
			}

			setIsDeleteOpen(false);
			router.replace(getPostListingUrl({ proposalType: postData.proposalType, origin: postData.onChainInfo?.origin }));
			router.refresh();
		} catch (error) {
			toast({
				title: 'Failed!',
				description: error instanceof Error ? error.message : 'Failed to delete post',
				status: ENotificationStatus.ERROR
			});
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					noArrow
					className='ml-auto h-8 w-8 border-none p-0 text-text_primary/[0.8]'
				>
					<Ellipsis size={16} />
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align='end'
					className='w-56'
				>
					{canEdit && (
						<DropdownMenuItem
							className='hover:bg-bg_pink/10'
							onSelect={() => setIsEditOpen(true)}
						>
							<Pencil size={16} />
							<span>{t('EditPost.editPostButton')}</span>
						</DropdownMenuItem>
					)}
					{canDelete && (
						<DropdownMenuItem
							className='hover:bg-bg_pink/10'
							onSelect={() => setIsDeleteOpen(true)}
						>
							<Trash2 size={16} />
							<span>{deleteLabel}</span>
						</DropdownMenuItem>
					)}
					{canLink && (
						<DropdownMenuItem
							className='hover:bg-bg_pink/10'
							onSelect={() => setIsLinkOpen(true)}
						>
							<Link size={16} />
							<span>{t('LinkDiscussionPost.linkDiscussion')}</span>
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog
				open={isEditOpen}
				onOpenChange={setIsEditOpen}
			>
				<DialogContent className='max-w-max p-3 sm:p-6'>
					<DialogHeader>
						<DialogTitle>{t('EditPost.edit')}</DialogTitle>
					</DialogHeader>
					<div className='max-w-3xl'>
						<EditPost
							postData={postData}
							onClose={() => setIsEditOpen(false)}
						/>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
			>
				<DialogContent className='max-w-xl p-6'>
					<DialogHeader>
						<DialogTitle>{deleteLabel}</DialogTitle>
					</DialogHeader>
					<DialogDescription className='text-text_primary'>Are you sure you want to delete this post?</DialogDescription>
					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setIsDeleteOpen(false)}
						>
							{t('PostDetails.cancel')}
						</Button>
						<Button
							variant='destructive'
							onClick={handleDelete}
							isLoading={isDeleting}
						>
							{deleteLabel}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={isLinkOpen}
				onOpenChange={setIsLinkOpen}
			>
				<DialogContent className='max-w-xl p-3 sm:p-6'>
					<DialogHeader>
						<DialogTitle>{t('LinkDiscussionPost.linkDiscussion')}</DialogTitle>
					</DialogHeader>
					<LinkDiscussionPost
						postData={postData}
						onClose={() => setIsLinkOpen(false)}
					/>
				</DialogContent>
			</Dialog>
		</>
	);
}

export default PostActionsMenu;
