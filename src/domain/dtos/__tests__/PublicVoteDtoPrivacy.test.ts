// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { describe, expect, it } from 'vitest';
import { toPublicReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { makeVote } from '@/domain/fixtures/referendaFixtures';

/**
 * Privacy contract (PR-1 / audit REF-SEC-01): the public vote DTO must never
 * expose the Firebase UID, the balance snapshot, or any private profile field.
 */
describe('PublicReferendumVoteDto privacy contract', () => {
	it('exposes only display name, decision, points and timestamps', () => {
		const dto = toPublicReferendumVoteDto(makeVote());
		expect(Object.keys(dto).sort()).toEqual(['createdAt', 'decision', 'pointsUsed', 'updatedAt', 'voterDisplayName']);
	});

	it('never contains uid or balanceAtVote', () => {
		const serialized = JSON.stringify(toPublicReferendumVoteDto(makeVote({ uid: 'secret-uid', balanceAtVote: 12345 })));
		expect(serialized).not.toContain('secret-uid');
		expect(serialized).not.toContain('"balanceAtVote"');
		expect(serialized).not.toContain('12345');
	});
});
