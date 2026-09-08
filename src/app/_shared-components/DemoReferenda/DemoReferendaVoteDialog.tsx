// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { type ReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { type ReferendumDecision, ReferendumDecision as EDecision } from '@/domain/entities/Referendum';
import { useToast } from '@/hooks/useToast';
import { ENotificationStatus } from '@/_shared/types';
import { Button } from '@/app/_shared-components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/_shared-components/Dialog/Dialog';
import { fetchReferendumCapabilities, type ReferendumCapabilitiesDto, removeMyVote, upsertMyVote } from '@/app/_client-services/points_referenda_client_service';

interface Props {
	index: number;
	existingVote: ReferendumVoteDto | null;
	onClose: () => void;
	onVoteChanged: (vote: ReferendumVoteDto) => void;
	onVoteRemoved: () => void;
}

type SuccessSummary = { decision: ReferendumDecision; pointsUsed: number; voterDisplayName: string };

function DemoReferendaVoteDialog({ index, existingVote, onClose, onVoteChanged, onVoteRemoved }: Props) {
	const { toast } = useToast();
	const t = useTranslations('DemoReferenda');

	const [decision, setDecision] = useState<ReferendumDecision>(existingVote?.decision ?? EDecision.AYE);
	// Raw string input (plan PR-6): empty/0 states must be REPRESENTABLE so
	// inline errors can be shown — no silent coercion back to 1.
	const [pointsInput, setPointsInput] = useState<string>(existingVote ? String(existingVote.pointsUsed) : '1');
	const [capabilities, setCapabilities] = useState<ReferendumCapabilitiesDto | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isRemoving, setIsRemoving] = useState(false);
	const [inlineError, setInlineError] = useState<string | null>(null);
	const [success, setSuccess] = useState<SuccessSummary | null>(null);

	const balance = capabilities?.pointsBalance ?? null;
	const parsedPoints = Number(pointsInput);
	const pointsValid = Number.isSafeInteger(parsedPoints) && parsedPoints >= 1 && (balance === null || parsedPoints <= balance);

	// Trusted capabilities (incl. authoritative pointsBalance) on open.
	useEffect(() => {
		let cancelled = false;
		fetchReferendumCapabilities(index)
			.then((caps) => {
				if (!cancelled) setCapabilities(caps);
			})
			.catch(() => {
				if (!cancelled) setCapabilities(null);
			});
		return () => {
			cancelled = true;
		};
	}, [index]);

	const handleVote = useCallback(async () => {
		setInlineError(null);
		if (!Number.isSafeInteger(parsedPoints) || parsedPoints < 1) {
			setInlineError(t('errors.minPoints'));
			return;
		}
		if (balance !== null && parsedPoints > balance) {
			setInlineError(t('errors.overBalance', { balance }));
			return;
		}
		setIsLoading(true); // duplicate-submit guard
		try {
			// Frozen contract (PR-1): PUT /votes/me returns `{ vote, stats }` —
			// handled entirely by the client service (auth, ok, validation).
			const { vote } = await upsertMyVote(index, decision, parsedPoints);
			setSuccess({ decision: vote.decision, pointsUsed: vote.pointsUsed, voterDisplayName: vote.voterDisplayName });
			onVoteChanged(vote);
			toast({ title: t('success.toast'), status: ENotificationStatus.SUCCESS });
		} catch (err) {
			// Inline server errors (403 insufficient balance, 409 closed, ...).
			const message = (err as Error).message || t('errors.generic');
			setInlineError(message);
			toast({ title: message, status: ENotificationStatus.ERROR });
		} finally {
			setIsLoading(false);
		}
	}, [index, decision, parsedPoints, balance, toast, t, onVoteChanged]);

	const handleRemove = useCallback(async () => {
		setInlineError(null);
		setIsRemoving(true);
		try {
			await removeMyVote(index);
			onVoteRemoved();
			toast({ title: t('removed.toast'), status: ENotificationStatus.SUCCESS });
		} catch (err) {
			const message = (err as Error).message || t('errors.generic');
			setInlineError(message);
			toast({ title: message, status: ENotificationStatus.ERROR });
		} finally {
			setIsRemoving(false);
		}
	}, [index, toast, t, onVoteRemoved]);

	const votingDisabled = capabilities !== null && !capabilities.canVote;

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className='max-w-md p-4 sm:p-6'>
				<DialogHeader>
					<DialogTitle className='text-xl font-semibold text-text_primary'>{success ? t('success.title') : existingVote ? t('changeTitle') : t('castTitle')}</DialogTitle>
				</DialogHeader>

				{success ? (
					/* Points-native success summary (plan PR-6) */
					<div className='space-y-4'>
						<div
							className='rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-text_primary'
							role='status'
						>
							<p className='font-semibold capitalize'>{success.decision}</p>
							<p className='mt-1'>
								{success.pointsUsed} {t('points')}
							</p>
							{success.voterDisplayName && <p className='mt-1 text-xs text-wallet_btn_text'>{success.voterDisplayName}</p>}
						</div>
						<div className='flex justify-end'>
							<Button onClick={onClose}>{t('close')}</Button>
						</div>
					</div>
				) : (
					<div className='space-y-4'>
						{/* Balance + Use max — authoritative from the capabilities API */}
						{balance !== null && (
							<div className='flex items-center justify-between text-sm'>
								<span className='text-wallet_btn_text'>{t('yourBalance')}</span>
								<span className='flex items-center gap-2 font-semibold text-text_primary'>
									{balance} {t('points')}
									<Button
										variant='ghost'
										size='sm'
										onClick={() => setPointsInput(String(balance))}
									>
										{t('useMax')}
									</Button>
								</span>
							</div>
						)}

						{votingDisabled && <p className='rounded-md bg-grey_bg p-2 text-xs text-wallet_btn_text'>{capabilities?.isClosed ? t('errors.closed') : t('errors.notOpen')}</p>}

						<div>
							<p
								className='mb-2 text-sm font-medium text-text_primary'
								id='decision-label'
							>
								{t('decision')}
							</p>
							<div
								className='flex gap-2'
								role='group'
								aria-labelledby='decision-label'
							>
								{([EDecision.AYE, EDecision.NAY, EDecision.ABSTAIN] as ReferendumDecision[]).map((d) => (
									<button
										key={d}
										type='button'
										aria-pressed={decision === d}
										className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
											decision === d
												? d === EDecision.AYE
													? 'border-success bg-success/10 text-success'
													: d === EDecision.NAY
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
							<label
								className='mb-1 block text-sm font-medium text-text_primary'
								htmlFor='points-input'
							>
								{t('pointsToUse')}
							</label>
							<input
								id='points-input'
								type='number'
								min={1}
								step={1}
								value={pointsInput}
								onChange={(e) => setPointsInput(e.target.value)}
								aria-invalid={!pointsValid}
								aria-describedby={inlineError ? 'vote-inline-error' : undefined}
								className='mt-1 w-full rounded-lg border border-border_grey bg-bg_modal px-3 py-2 text-sm text-text_primary focus:outline-none focus:ring-2 focus:ring-text_pink'
							/>
						</div>

						{!pointsValid && pointsInput !== '' && (
							<p className='text-xs text-failure'>
								{Number.isSafeInteger(parsedPoints) && parsedPoints < 1
									? t('errors.minPoints')
									: balance !== null && parsedPoints > balance
										? t('errors.overBalance', { balance })
										: t('errors.invalid')}
							</p>
						)}

						{inlineError && (
							<p
								id='vote-inline-error'
								role='alert'
								className='text-xs text-failure'
							>
								{inlineError}
							</p>
						)}

						{existingVote && (
							<Button
								variant='ghost'
								size='sm'
								isLoading={isRemoving}
								disabled={votingDisabled}
								onClick={handleRemove}
								className='text-failure hover:bg-failure/10'
							>
								{t('removeVote')}
							</Button>
						)}
						<div className='flex justify-end gap-2'>
							<Button
								variant='ghost'
								onClick={onClose}
							>
								{t('cancel')}
							</Button>
							<Button
								onClick={handleVote}
								isLoading={isLoading}
								disabled={votingDisabled || !pointsValid}
							>
								{existingVote ? t('changeVote') : t('castVote')}
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

export default DemoReferendaVoteDialog;
