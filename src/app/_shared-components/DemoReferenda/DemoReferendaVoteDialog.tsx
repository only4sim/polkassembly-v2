// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useCallback, useState } from 'react';
import { type ReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { type ReferendumDecision, ReferendumDecision as EDecision } from '@/domain/entities/Referendum';
import { useToast } from '@/hooks/useToast';
import { ENotificationStatus } from '@/_shared/types';
import { Button } from '@/app/_shared-components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/_shared-components/Dialog/Dialog';
import { removeMyVote, upsertMyVote } from '@/app/_client-services/points_referenda_client_service';

interface Props {
	index: number;
	existingVote: ReferendumVoteDto | null;
	onClose: () => void;
	onVoteChanged: (vote: ReferendumVoteDto) => void;
	onVoteRemoved: () => void;
}

function DemoReferendaVoteDialog({ index, existingVote, onClose, onVoteChanged, onVoteRemoved }: Props) {
	const { toast } = useToast();

	const [decision, setDecision] = useState<ReferendumDecision>(existingVote?.decision ?? EDecision.AYE);
	const [pointsUsed, setPointsUsed] = useState<number>(existingVote?.pointsUsed ?? 1);
	const [isLoading, setIsLoading] = useState(false);
	const [isRemoving, setIsRemoving] = useState(false);

	const handleVote = useCallback(async () => {
		if (pointsUsed < 1) {
			toast({ title: 'You must use at least 1 point.', status: ENotificationStatus.WARNING });
			return;
		}
		setIsLoading(true);
		try {
			// Frozen contract (PR-1): PUT /votes/me returns `{ vote, stats }` —
			// handled entirely by the client service (auth, ok, validation).
			const { vote } = await upsertMyVote(index, decision, pointsUsed);
			onVoteChanged(vote);
			toast({ title: 'Vote cast successfully!', status: ENotificationStatus.SUCCESS });
		} catch (err) {
			toast({ title: (err as Error).message || 'Failed to cast vote.', status: ENotificationStatus.ERROR });
		} finally {
			setIsLoading(false);
		}
	}, [index, decision, pointsUsed, toast, onVoteChanged]);

	const handleRemove = useCallback(async () => {
		setIsRemoving(true);
		try {
			await removeMyVote(index);
			onVoteRemoved();
			toast({ title: 'Vote removed.', status: ENotificationStatus.SUCCESS });
		} catch (err) {
			toast({ title: (err as Error).message || 'Failed to remove vote.', status: ENotificationStatus.ERROR });
		} finally {
			setIsRemoving(false);
		}
	}, [index, toast, onVoteRemoved]);

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className='max-w-md p-4 sm:p-6'>
				<DialogHeader>
					<DialogTitle className='text-xl font-semibold text-text_primary'>{existingVote ? 'Change Your Vote' : 'Cast Your Vote'}</DialogTitle>
				</DialogHeader>
				<div className='space-y-4'>
					<div>
						<p className='mb-2 text-sm font-medium text-text_primary'>Decision</p>
						<div className='flex gap-2'>
							{([EDecision.AYE, EDecision.NAY, EDecision.ABSTAIN] as ReferendumDecision[]).map((d) => (
								<button
									key={d}
									type='button'
									className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
										decision === d
											? d === 'aye'
												? 'border-success bg-success/10 text-success'
												: d === 'nay'
													? 'border-failure bg-failure/10 text-failure'
													: 'border-decision_bar_indicator bg-decision_bar_indicator/10 text-decision_bar_indicator'
											: 'border-border_grey text-text_primary hover:bg-grey_bg'
									}`}
									onClick={() => setDecision(d)}
								>
									{d}
								</button>
							))}
						</div>
					</div>
					<div>
						{/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
						<label className='mb-1 block text-sm font-medium text-text_primary'>
							Points to use
							<input
								id='points-input'
								type='number'
								min={1}
								value={pointsUsed}
								onChange={(e) => setPointsUsed(Math.max(1, Number(e.target.value) || 1))}
								className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
							/>
						</label>
					</div>
					{existingVote && (
						<Button
							variant='ghost'
							size='sm'
							isLoading={isRemoving}
							onClick={handleRemove}
							className='text-failure hover:bg-failure/10'
						>
							Remove Vote
						</Button>
					)}
					<div className='flex justify-end gap-2'>
						<Button
							variant='ghost'
							onClick={onClose}
						>
							Cancel
						</Button>
						<Button
							onClick={handleVote}
							isLoading={isLoading}
						>
							{existingVote ? 'Change Vote' : 'Cast Vote'}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default DemoReferendaVoteDialog;
