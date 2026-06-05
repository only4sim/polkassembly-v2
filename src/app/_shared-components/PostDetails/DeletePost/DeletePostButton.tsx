// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { IPost, IPostListing } from '@/_shared/types';
import { useUser } from '@/hooks/useUser';
import { useTranslations } from 'next-intl';
import { NextApiClientService } from '@/app/_client-services/next_api_client_service';
import { ValidatorService } from '@/_shared/_services/validator_service';
import { getPostListingUrl } from '@/app/_client-utils/getPostListingUrl';
import { Button } from '../../Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../Dialog/Dialog';

function DeletePostButton({ postData, className }: { postData: IPostListing | IPost; className?: string }) {
	const { user } = useUser();
	const t = useTranslations();
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const canDelete = Boolean(user?.id && user.id === postData.userId && ValidatorService.isValidNumber(postData.index));

	if (!canDelete) return null;

	const deleteLabel = t('PostDetails.delete');
	const deleteConfirmation = t('PostDetails.deleteCommentConfirmation');

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

			setIsOpen(false);
			router.replace(getPostListingUrl({ proposalType: postData.proposalType, origin: postData.onChainInfo?.origin }));
			router.refresh();
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={setIsOpen}
		>
			<DialogTrigger asChild>
				<Button
					variant='ghost'
					size='sm'
					className={className}
					leftIcon={<Trash2 size={16} />}
				>
					{deleteLabel}
				</Button>
			</DialogTrigger>
			<DialogContent className='max-w-xl p-6'>
				<DialogHeader>
					<DialogTitle>{deleteLabel}</DialogTitle>
				</DialogHeader>
				<DialogDescription className='text-text_primary'>{deleteConfirmation}</DialogDescription>
				<DialogFooter>
					<Button
						variant='outline'
						onClick={() => setIsOpen(false)}
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
	);
}

export default DeletePostButton;
