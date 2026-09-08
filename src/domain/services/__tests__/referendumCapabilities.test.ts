// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { describe, expect, it } from 'vitest';
import { ReferendumStatus } from '@/domain/entities/Referendum';
import { deriveReferendumCapabilities } from '../referendumCapabilities';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const HOUR = 3600000;
const START = new Date(NOW.getTime() - 24 * HOUR);
const END = new Date(NOW.getTime() + 24 * HOUR);

function base(overrides: Partial<Parameters<typeof deriveReferendumCapabilities>[0]> = {}) {
	return {
		status: ReferendumStatus.Deciding,
		now: NOW,
		votingStartsAt: START,
		votingEndsAt: END,
		isAuthenticated: true,
		isAdmin: false,
		...overrides
	};
}

describe('deriveReferendumCapabilities', () => {
	it('open window + authenticated: canVote/change/remove true, canCancel false', () => {
		const caps = deriveReferendumCapabilities(base());
		expect(caps.isVotingOpen).toBe(true);
		expect(caps.canVote).toBe(true);
		expect(caps.canChangeVote).toBe(true);
		expect(caps.canRemoveVote).toBe(true);
		expect(caps.canCancel).toBe(false);
		expect(caps.isClosed).toBe(false);
	});

	it('anonymous users can never vote', () => {
		const caps = deriveReferendumCapabilities(base({ isAuthenticated: false }));
		expect(caps.isVotingOpen).toBe(true);
		expect(caps.canVote).toBe(false);
		expect(caps.canRemoveVote).toBe(false);
	});

	it('half-open window: exactly at votingEndsAt is CLOSED (server contract)', () => {
		const caps = deriveReferendumCapabilities(base({ now: END }));
		expect(caps.isVotingOpen).toBe(false);
		expect(caps.canVote).toBe(false);
	});

	it('exactly at votingStartsAt is OPEN', () => {
		const caps = deriveReferendumCapabilities(base({ now: START }));
		expect(caps.isVotingOpen).toBe(true);
	});

	it('terminal statuses are closed regardless of window', () => {
		const terminalStatuses = [ReferendumStatus.Confirmed, ReferendumStatus.Rejected, ReferendumStatus.Cancelled];
		terminalStatuses.forEach((status) => {
			const caps = deriveReferendumCapabilities(base({ status }));
			expect(caps.isClosed).toBe(true);
			expect(caps.isVotingOpen).toBe(false);
			expect(caps.canVote).toBe(false);
		});
	});

	it('admin can cancel open referenda but not terminal ones', () => {
		expect(deriveReferendumCapabilities(base({ isAdmin: true })).canCancel).toBe(true);
		expect(deriveReferendumCapabilities(base({ isAdmin: true, status: ReferendumStatus.Submitted })).canCancel).toBe(true);
		const terminalStatuses = [ReferendumStatus.Confirmed, ReferendumStatus.Cancelled];
		terminalStatuses.forEach((status) => {
			expect(deriveReferendumCapabilities(base({ isAdmin: true, status })).canCancel).toBe(false);
			expect(deriveReferendumCapabilities(base({ status })).canCancel).toBe(false);
		});
	});

	it('Submitted is not votable even when window dates would fit', () => {
		const caps = deriveReferendumCapabilities(base({ status: ReferendumStatus.Submitted }));
		expect(caps.isVotingOpen).toBe(false);
		expect(caps.canVote).toBe(false);
	});
});
