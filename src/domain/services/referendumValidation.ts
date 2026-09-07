// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable max-classes-per-file, no-use-before-define, sonarjs/no-duplicate-string */

import { ReferendumDecision, REFERENDA_ORIGINS, REFERENDUM_LIMITS, ReferendumStatus, type ReferendumOrigin } from '../entities/Referendum';

export type VoteValidationErrorCode =
	| 'not-logged-in'
	| 'referendum-not-found'
	| 'not-deciding'
	| 'outside-voting-window'
	| 'invalid-decision'
	| 'invalid-amount'
	| 'insufficient-balance';

export class VoteValidationError extends Error {
	code: VoteValidationErrorCode;

	constructor(code: VoteValidationErrorCode, message: string) {
		super(message);
		this.name = 'VoteValidationError';
		this.code = code;
	}
}

export interface VoteValidationContext {
	uid: string;
	decision: unknown;
	pointsUsed: unknown;
	pointsBalance: number;
	referendumStatus: ReferendumStatus | undefined;
	now: Date;
	votingStartsAt: Date | undefined;
	votingEndsAt: Date | undefined;
}

/**
 * Pure validation for a single vote write (create or change).
 *
 * Rules enforced here (mirrored server-side inside the Firestore transaction):
 * - `uid` must be present (identity is derived from the verified auth token).
 * - decision must be one of aye/nay/abstain.
 * - pointsUsed must be a safe integer in [1, pointsBalance].
 * - referendum must be in Deciding status.
 * - `now` must be within [votingStartsAt, votingEndsAt].
 *
 * Returns a normalized vote payload on success; throws `VoteValidationError` otherwise.
 */
export function validateVoteInput(ctx: VoteValidationContext): { decision: ReferendumDecision; pointsUsed: number } {
	if (!ctx.uid) {
		throw new VoteValidationError('not-logged-in', 'You must be logged in to vote.');
	}

	if (ctx.referendumStatus === undefined || ctx.referendumStatus === null) {
		throw new VoteValidationError('referendum-not-found', 'Referendum not found.');
	}

	if (ctx.referendumStatus !== ReferendumStatus.Deciding) {
		throw new VoteValidationError('not-deciding', 'Voting is only allowed while the referendum is Deciding.');
	}

	// Time window (server time).
	// Frozen contract (PR-1): half-open interval `votingStartsAt <= now < votingEndsAt`.
	if (ctx.votingStartsAt && ctx.votingEndsAt) {
		const nowMs = ctx.now.getTime();
		if (nowMs < ctx.votingStartsAt.getTime()) {
			throw new VoteValidationError('outside-voting-window', 'Voting has not started yet.');
		}
		if (nowMs >= ctx.votingEndsAt.getTime()) {
			throw new VoteValidationError('outside-voting-window', 'Voting has ended.');
		}
	}

	if (ctx.decision !== ReferendumDecision.AYE && ctx.decision !== ReferendumDecision.NAY && ctx.decision !== ReferendumDecision.ABSTAIN) {
		throw new VoteValidationError('invalid-decision', 'decision must be aye, nay, or abstain.');
	}
	const decision = ctx.decision as ReferendumDecision;

	if (typeof ctx.pointsUsed !== 'number' || !Number.isInteger(ctx.pointsUsed) || !Number.isSafeInteger(ctx.pointsUsed)) {
		throw new VoteValidationError('invalid-amount', 'pointsUsed must be an integer.');
	}
	if (ctx.pointsUsed < 1) {
		throw new VoteValidationError('invalid-amount', 'You must use at least 1 point to vote.');
	}
	if (ctx.pointsUsed > ctx.pointsBalance) {
		throw new VoteValidationError('insufficient-balance', `You cannot use more than your current points balance (${ctx.pointsBalance}).`);
	}

	return { decision, pointsUsed: ctx.pointsUsed };
}

/**
 * Validate that removal is still permitted (referendum votable).
 * Mirrors the server-side check inside the vote-removal transaction.
 */
export function assertRemovalAllowed(referendumStatus: ReferendumStatus | undefined, now: Date, votingStartsAt?: Date, votingEndsAt?: Date): void {
	if (referendumStatus !== ReferendumStatus.Deciding) {
		throw new VoteValidationError('not-deciding', 'Voting is only allowed while the referendum is Deciding.');
	}
	if (votingStartsAt && votingEndsAt) {
		const nowMs = now.getTime();
		// Frozen contract (PR-1): half-open interval `votingStartsAt <= now < votingEndsAt`.
		if (nowMs < votingStartsAt.getTime()) {
			throw new VoteValidationError('outside-voting-window', 'Voting has not started yet.');
		}
		if (nowMs >= votingEndsAt.getTime()) {
			throw new VoteValidationError('outside-voting-window', 'Voting has ended.');
		}
	}
}

export type CreationValidationErrorCode = 'unauthorized' | 'invalid-title' | 'invalid-content' | 'invalid-origin' | 'invalid-tags' | 'invalid-dates' | 'invalid-thresholds';

export class CreationValidationError extends Error {
	code: CreationValidationErrorCode;

	constructor(code: CreationValidationErrorCode, message: string) {
		super(message);
		this.name = 'CreationValidationError';
		this.code = code;
	}
}

export interface CreationValidationContext {
	uid: string;
	title: unknown;
	content: unknown;
	origin: unknown;
	tags?: unknown;
	votingStartsAt: unknown;
	votingEndsAt: unknown;
	approvalThresholdBps: unknown;
	minimumTurnoutPoints: unknown;
}

export interface ValidatedCreation {
	title: string;
	content: string;
	origin: ReferendumOrigin;
	tags: string[];
	votingStartsAt: Date;
	votingEndsAt: Date;
	approvalThresholdBps: number;
	minimumTurnoutPoints: number;
}

/**
 * Pure validation for referendum creation inputs. The author UID is derived
 * server-side from the verified token and passed in.
 */
export function validateCreationInput(ctx: CreationValidationContext): ValidatedCreation {
	if (!ctx.uid) {
		throw new CreationValidationError('unauthorized', 'You must be logged in to create a referendum.');
	}

	if (typeof ctx.title !== 'string' || ctx.title.trim().length < REFERENDUM_LIMITS.MIN_TITLE_LENGTH || ctx.title.trim().length > REFERENDUM_LIMITS.MAX_TITLE_LENGTH) {
		throw new CreationValidationError('invalid-title', `Title must be between ${REFERENDUM_LIMITS.MIN_TITLE_LENGTH} and ${REFERENDUM_LIMITS.MAX_TITLE_LENGTH} characters.`);
	}

	if (typeof ctx.content !== 'string' || ctx.content.trim().length < REFERENDUM_LIMITS.MIN_CONTENT_LENGTH || ctx.content.trim().length > REFERENDUM_LIMITS.MAX_CONTENT_LENGTH) {
		throw new CreationValidationError('invalid-content', `Content must be between ${REFERENDUM_LIMITS.MIN_CONTENT_LENGTH} and ${REFERENDUM_LIMITS.MAX_CONTENT_LENGTH} characters.`);
	}

	if (typeof ctx.origin !== 'string' || !(REFERENDA_ORIGINS as readonly string[]).includes(ctx.origin)) {
		throw new CreationValidationError('invalid-origin', 'origin must be one of the supported referendum origins.');
	}

	let tags: string[] = [];
	if (ctx.tags !== undefined) {
		if (!Array.isArray(ctx.tags)) {
			throw new CreationValidationError('invalid-tags', 'tags must be an array of strings.');
		}
		if (ctx.tags.length > REFERENDUM_LIMITS.MAX_TAGS) {
			throw new CreationValidationError('invalid-tags', `A referendum can have at most ${REFERENDUM_LIMITS.MAX_TAGS} tags.`);
		}
		if (!ctx.tags.every((t) => typeof t === 'string' && t.trim().length > 0)) {
			throw new CreationValidationError('invalid-tags', 'tags must be non-empty strings.');
		}
		tags = ctx.tags.map((t) => t.trim()).slice(0, REFERENDUM_LIMITS.MAX_TAGS);
	}

	const startsAt = toDate(ctx.votingStartsAt, 'invalid-dates', 'votingStartsAt must be a valid date.');
	const endsAt = toDate(ctx.votingEndsAt, 'invalid-dates', 'votingEndsAt must be a valid date.');
	if (endsAt.getTime() <= startsAt.getTime()) {
		throw new CreationValidationError('invalid-dates', 'votingEndsAt must be after votingStartsAt.');
	}

	const threshold = validateBps(ctx.approvalThresholdBps);
	const turnout = validateNonNegativeInt(ctx.minimumTurnoutPoints, 'minimumTurnoutPoints');

	return {
		title: ctx.title.trim(),
		content: ctx.content.trim(),
		origin: ctx.origin as ReferendumOrigin,
		tags,
		votingStartsAt: startsAt,
		votingEndsAt: endsAt,
		approvalThresholdBps: threshold,
		minimumTurnoutPoints: turnout
	};
}

function toDate(value: unknown, code: CreationValidationErrorCode, message: string): Date {
	if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
		throw new CreationValidationError(code, message);
	}
	return new Date(value);
}

function validateBps(value: unknown): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isSafeInteger(value) || value < 0 || value > 10000) {
		throw new CreationValidationError('invalid-thresholds', 'approvalThresholdBps must be an integer between 0 and 10000.');
	}
	return value;
}

function validateNonNegativeInt(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isSafeInteger(value) || value < 0) {
		throw new CreationValidationError('invalid-thresholds', `${label} must be a non-negative integer.`);
	}
	return value;
}
