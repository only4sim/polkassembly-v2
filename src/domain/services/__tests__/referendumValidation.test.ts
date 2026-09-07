// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { describe, expect, it } from 'vitest';
import { ReferendumDecision, ReferendumStatus } from '@/domain/entities/Referendum';
import { VoteValidationError, validateCreationInput, validateVoteInput, CreationValidationError } from '@/domain/services/referendumValidation';

const now = new Date('2026-08-21T12:00:00Z');
const window = {
	votingStartsAt: new Date('2026-08-20T12:00:00Z'),
	votingEndsAt: new Date('2026-08-22T12:00:00Z')
};

function ctx(overrides: Record<string, unknown> = {}) {
	return {
		uid: 'uid-1',
		decision: ReferendumDecision.AYE,
		pointsUsed: 100,
		pointsBalance: 1000,
		referendumStatus: ReferendumStatus.Deciding,
		now,
		...window,
		...overrides
	};
}

describe('validateVoteInput', () => {
	it('accepts a valid aye vote', () => {
		const result = validateVoteInput(ctx());
		expect(result).toEqual({ decision: ReferendumDecision.AYE, pointsUsed: 100 });
	});

	it('accepts nay and abstain', () => {
		expect(validateVoteInput(ctx({ decision: ReferendumDecision.NAY })).decision).toBe(ReferendumDecision.NAY);
		expect(validateVoteInput(ctx({ decision: ReferendumDecision.ABSTAIN })).decision).toBe(ReferendumDecision.ABSTAIN);
	});

	it('rejects missing uid', () => {
		let err: unknown;
		try {
			validateVoteInput(ctx({ uid: '' }));
		} catch (e) {
			err = e;
		}
		expect(err).toBeInstanceOf(VoteValidationError);
		expect((err as VoteValidationError).code).toBe('not-logged-in');
	});

	it('rejects unknown decision', () => {
		expect(() => validateVoteInput(ctx({ decision: 'split' }))).toThrowError(/aye, nay, or abstain/);
	});

	it('rejects non-integer pointsUsed', () => {
		expect(() => validateVoteInput(ctx({ pointsUsed: 10.5 }))).toThrowError(/integer/);
		expect(() => validateVoteInput(ctx({ pointsUsed: Number.MAX_SAFE_INTEGER + 2 }))).toThrowError(/integer/);
	});

	it('rejects pointsUsed below 1', () => {
		expect(() => validateVoteInput(ctx({ pointsUsed: 0 }))).toThrowError(/at least 1 point/);
		expect(() => validateVoteInput(ctx({ pointsUsed: -5 }))).toThrowError(/at least 1 point/);
	});

	it('rejects pointsUsed above pointsBalance', () => {
		expect(() => validateVoteInput(ctx({ pointsUsed: 1001, pointsBalance: 1000 }))).toThrowError(/cannot use more/);
	});

	it('accepts pointsUsed equal to balance (boundary)', () => {
		const result = validateVoteInput(ctx({ pointsUsed: 1000, pointsBalance: 1000 }));
		expect(result.pointsUsed).toBe(1000);
	});

	it('rejects non-Deciding referenda', () => {
		expect(() => validateVoteInput(ctx({ referendumStatus: ReferendumStatus.Submitted }))).toThrowError(/Deciding/);
		expect(() => validateVoteInput(ctx({ referendumStatus: ReferendumStatus.Confirmed }))).toThrowError(/Deciding/);
		expect(() => validateVoteInput(ctx({ referendumStatus: ReferendumStatus.Cancelled }))).toThrowError(/Deciding/);
	});

	it('rejects votes before the window opens and after it closes', () => {
		expect(() => validateVoteInput(ctx({ now: new Date('2026-08-19T12:00:00Z') }))).toThrowError(/has not started/);
		expect(() => validateVoteInput(ctx({ now: new Date('2026-08-23T12:00:00Z') }))).toThrowError(/has ended/);
	});

	it('rejects missing referendum (not found)', () => {
		expect(() => validateVoteInput(ctx({ referendumStatus: undefined }))).toThrowError(/not found/);
	});
});

describe('validateCreationInput', () => {
	const baseCreation = {
		uid: 'uid-1',
		title: 'A valid referendum title',
		content: 'This referendum content is sufficiently long.',
		origin: 'root',
		tags: ['treasury', 'governance'],
		votingStartsAt: '2026-09-01T00:00:00Z',
		votingEndsAt: '2026-09-08T00:00:00Z',
		approvalThresholdBps: 5000,
		minimumTurnoutPoints: 100
	};

	it('accepts a valid creation payload', () => {
		const result = validateCreationInput(baseCreation);
		expect(result.title).toBe(baseCreation.title);
		expect(result.origin).toBe('root');
		expect(result.approvalThresholdBps).toBe(5000);
		expect(result.votingEndsAt > result.votingStartsAt).toBe(true);
	});

	it('rejects unauthenticated creation', () => {
		let err: unknown;
		try {
			validateCreationInput({ ...baseCreation, uid: '' });
		} catch (e) {
			err = e;
		}
		expect(err).toBeInstanceOf(CreationValidationError);
		expect((err as CreationValidationError).code).toBe('unauthorized');
	});

	it('rejects invalid origins', () => {
		expect(() => validateCreationInput({ ...baseCreation, origin: 'polkadot_native_custom_origin' })).toThrowError(/supported referendum origins/);
	});

	it('rejects short titles and content', () => {
		expect(() => validateCreationInput({ ...baseCreation, title: 'abc' })).toThrowError(/Title must be/);
		expect(() => validateCreationInput({ ...baseCreation, content: 'too short' })).toThrowError(/Content must be/);
	});

	it('rejects inverted date windows', () => {
		expect(() =>
			validateCreationInput({
				...baseCreation,
				votingStartsAt: '2026-09-08T00:00:00Z',
				votingEndsAt: '2026-09-01T00:00:00Z'
			})
		).toThrowError(/votingEndsAt must be after/);
	});

	it('rejects invalid thresholds', () => {
		expect(() => validateCreationInput({ ...baseCreation, approvalThresholdBps: 10001 })).toThrowError(/approvalThresholdBps/);
		expect(() => validateCreationInput({ ...baseCreation, approvalThresholdBps: -1 })).toThrowError(/approvalThresholdBps/);
		expect(() => validateCreationInput({ ...baseCreation, minimumTurnoutPoints: -1 })).toThrowError(/minimumTurnoutPoints/);
		expect(() => validateCreationInput({ ...baseCreation, approvalThresholdBps: 50.5 })).toThrowError(/approvalThresholdBps/);
	});

	it('rejects too many or malformed tags', () => {
		const manyTags = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
		expect(() => validateCreationInput({ ...baseCreation, tags: manyTags })).toThrowError(/at most 10 tags/);
		expect(() => validateCreationInput({ ...baseCreation, tags: ['valid', ''] })).toThrowError(/non-empty strings/);
		expect(() => validateCreationInput({ ...baseCreation, tags: 'not-an-array' })).toThrowError(/array of strings/);
	});
});
