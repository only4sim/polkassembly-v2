// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { describe, expect, it } from 'vitest';
import { toReferendumDetailDto, toReferendumStatsDto, toReferendumSummaryDto, toReferendumVoteDto } from '@/domain/dtos/ReferendaDtos';
import { makeReferendum, makeStats, makeVote } from '@/domain/fixtures/referendaFixtures';

describe('Referenda DTO mappings', () => {
	it('maps a Referendum to a detail DTO with ISO strings', () => {
		const r = makeReferendum();
		const dto = toReferendumDetailDto(r);
		expect(dto.index).toBe(r.index);
		expect(dto.title).toBe(r.title);
		expect(dto.content).toBe(r.content);
		expect(dto.status).toBe(r.status);
		expect(dto.schemaVersion).toBe(r.schemaVersion);
		expect(typeof dto.createdAt).toBe('string');
		expect(new Date(dto.votingEndsAt).getTime()).toBe(new Date(r.votingEndsAt).getTime());
	});

	it('summary DTO omits content/updatedAt/schemaVersion', () => {
		const dto = toReferendumSummaryDto(makeReferendum({ content: 'secret-body' }));
		expect(dto).not.toHaveProperty('content');
		expect(dto).not.toHaveProperty('updatedAt');
		expect(dto.index).toBe(1);
	});

	it('stats DTO computes approval and participating points', () => {
		const dto = toReferendumStatsDto(makeStats({ ayePoints: 100, nayPoints: 50, abstainPoints: 20 }));
		expect(dto.approvalBps).toBe(6667); // 100/150
		expect(dto.participatingPoints).toBe(170);
		expect(dto.totalVoters).toBe(6);
	});

	it('vote DTO exposes point-native, non-chain fields', () => {
		const dto = toReferendumVoteDto(makeVote());
		expect(dto.decision).toBe('aye');
		expect(dto.pointsUsed).toBe(100);
		expect(dto.balanceAtVote).toBe(1000);
	});
});
