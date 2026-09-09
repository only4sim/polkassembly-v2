// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable import/first, import/order, max-classes-per-file, lines-between-class-members */

/**
 * Frozen API contract tests (PR-1).
 *
 * These tests invoke the real Next.js route handlers with mocked services and
 * pin the HTTP response shapes and status codes required by
 * docs/REFERENDA_REPAIR_AND_DEVELOPMENT_PLAN_2026-09-07.md (Phase 0):
 *
 *   GET  /votes/me  -> { vote: ReferendumVoteDto | null }
 *   PUT  /votes/me  -> { vote: ReferendumVoteDto, stats: ReferendumStatsDto }
 *   DELETE /votes/me -> { removed: true, stats: ReferendumStatsDto }
 *   POST /referenda  -> { referendum: ReferendumDetailDto }
 *   GET  /votes      -> { items: PublicReferendumVoteDto[], totalCount }
 *   GET  /referenda  -> list DTO; invalid filters return 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	getByIndex: vi.fn(),
	getVote: vi.fn(),
	listVotes: vi.fn(),
	countVotes: vi.fn(),
	upsertVote: vi.fn(),
	removeVote: vi.fn(),
	createReferendum: vi.fn(),
	requireVerifiedActor: vi.fn(),
	isAdminActor: vi.fn(),
	getAdminOverview: vi.fn()
}));

vi.mock('@/app/api/_api-services/referenda/referendumReadService', () => ({
	ReferendumReadService: class {
		list = mocks.list;
		getByIndex = mocks.getByIndex;
		getVote = mocks.getVote;
		listVotes = mocks.listVotes;
		countVotes = mocks.countVotes;
		getAdminOverview = mocks.getAdminOverview;
	}
}));

vi.mock('@/app/api/_api-services/referenda/referendumTrustedService', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/app/api/_api-services/referenda/referendumTrustedService')>();
	return {
		...actual,
		ReferendumTrustedService: class {
			upsertVote = mocks.upsertVote;
			removeVote = mocks.removeVote;
			createReferendum = mocks.createReferendum;
		}
	};
});

vi.mock('@/app/api/_api-utils/referendaAuth', () => ({
	requireVerifiedActor: mocks.requireVerifiedActor,
	isAdminActor: mocks.isAdminActor
}));

import { GET as listGET, POST as referendaPOST } from '../route';
import { GET as historyGET } from '../[index]/votes/route';
import { GET as adminOverviewGET } from '../admin/overview/route';
import { DELETE as meDELETE, GET as meGET, PUT as mePUT } from '../[index]/votes/me/route';
import { CreationValidationError } from '@/domain/services/referendumValidation';
import { ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { ReferendumDecision, ReferendumStatus } from '@/domain/entities/Referendum';

const UNAUTHORIZED_MESSAGE = 'You must be logged in.';
const ADMIN_OVERVIEW_URL = '/api/v2/referenda/admin/overview';
import { makeReferendum, makeStats, makeVote } from '@/domain/fixtures/referendaFixtures';
import { toPublicReferendumVoteDto, toReferendumStatsDto } from '@/domain/dtos/ReferendaDtos';

const JSON_CONTENT_TYPE = 'application/json';
const REFERENDA_URL = '/api/v2/referenda';
const req = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => new NextRequest(`http://localhost:3000${url}`, init);
const ctx = (index: string) => ({ params: Promise.resolve({ index }) });

// Frozen own-vote endpoint URL (PR-1): repeated across the contract tests.
const meUrl = '/api/v2/referenda/1/votes/me';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireVerifiedActor.mockResolvedValue({ uid: 'uid-1', displayName: 'Voter One' });
	mocks.isAdminActor.mockResolvedValue(false);
});

describe('GET /api/v2/referenda (list)', () => {
	it('rejects invalid status values with 400', async () => {
		const res = await listGET(req('/api/v2/referenda?status=Bogus'));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.message).toContain('Bogus');
	});

	it('rejects unsupported origin with 400', async () => {
		const res = await listGET(req('/api/v2/referenda?origin=not-an-origin'));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.message).toContain('origin');
	});

	it('rejects non-numeric page with 400', async () => {
		const res = await listGET(req('/api/v2/referenda?page=abc'));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.message).toContain('page');
	});

	it('passes frozen query contract to the read service', async () => {
		mocks.list.mockResolvedValue({ items: [], totalCount: 0 });
		const res = await listGET(req('/api/v2/referenda?page=2&pageSize=5&status=Deciding,Rejected&origin=root'));
		expect(res.status).toBe(200);
		expect(mocks.list).toHaveBeenCalledWith({
			page: 2,
			pageSize: 5,
			statuses: [ReferendumStatus.Deciding, ReferendumStatus.Rejected],
			origin: 'root'
		});
	});
});

describe('POST /api/v2/referenda (create)', () => {
	it('returns frozen shape `{ referendum: ReferendumDetailDto }` with the in-transaction status', async () => {
		// PR-4: the service decides Submitted/Deciding inside the creation
		// transaction; the route no longer performs a second transition call.
		mocks.createReferendum.mockResolvedValue(makeReferendum({ status: ReferendumStatus.Deciding }));

		const res = await referendaPOST(
			req(REFERENDA_URL, {
				method: 'POST',
				headers: { 'content-type': JSON_CONTENT_TYPE },
				body: JSON.stringify({
					title: 'A valid referendum title',
					content: 'This referendum content is sufficiently long.',
					origin: 'root',
					votingStartsAt: '2026-01-01T00:00:00Z',
					votingEndsAt: '2027-01-01T00:00:00Z',
					approvalThresholdBps: 5000,
					minimumTurnoutPoints: 1
				})
			})
		);
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(Object.keys(body)).toEqual(['referendum']);
		expect(body.referendum.status).toBe('Deciding');
		expect(body.referendum.index).toBe(1);
	});

	it('maps an already-expired voting window to 400', async () => {
		mocks.createReferendum.mockRejectedValue(new ReferendaServiceError('invalid-argument', 'The voting window has already expired.'));
		const res = await referendaPOST(
			req(REFERENDA_URL, {
				method: 'POST',
				headers: { 'content-type': JSON_CONTENT_TYPE },
				body: JSON.stringify({
					title: 'A valid referendum title',
					content: 'This referendum content is sufficiently long.',
					origin: 'root',
					votingStartsAt: '2020-01-01T00:00:00Z',
					votingEndsAt: '2020-06-01T00:00:00Z',
					approvalThresholdBps: 5000,
					minimumTurnoutPoints: 1
				})
			})
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.message).toContain('expired');
	});

	it('maps creation validation errors to 400', async () => {
		mocks.createReferendum.mockRejectedValue(new CreationValidationError('invalid-title', 'Title must be between 4 and 120 characters.'));
		const res = await referendaPOST(
			req(REFERENDA_URL, {
				method: 'POST',
				headers: { 'content-type': JSON_CONTENT_TYPE },
				body: JSON.stringify({ title: 'ab' })
			})
		);
		expect(res.status).toBe(400);
	});
});
describe('GET /api/v2/referenda/{index}/votes/me', () => {
	it('returns frozen shape `{ vote: ReferendumVoteDto | null }`', async () => {
		mocks.getByIndex.mockResolvedValue(makeReferendum());
		mocks.getVote.mockResolvedValue(makeVote());
		const res = await meGET(req(meUrl), ctx('1'));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Object.keys(body)).toEqual(['vote']);
		expect(body.vote.uid).toBe('uid-1');
	});

	it('returns `{ vote: null }` when the user has not voted', async () => {
		mocks.getByIndex.mockResolvedValue(makeReferendum());
		mocks.getVote.mockResolvedValue(null);
		const res = await meGET(req(meUrl), ctx('1'));
		const body = await res.json();
		expect(body).toEqual({ vote: null });
	});

	it('returns 404 when the referendum does not exist', async () => {
		mocks.getByIndex.mockResolvedValue(null);
		const res = await meGET(req('/api/v2/referenda/999/votes/me'), ctx('999'));
		expect(res.status).toBe(404);
	});

	it('returns 401 when authentication fails', async () => {
		mocks.requireVerifiedActor.mockRejectedValue(new ReferendaServiceError('unauthorized', UNAUTHORIZED_MESSAGE));
		const res = await meGET(req(meUrl), ctx('1'));
		expect(res.status).toBe(401);
	});
});

describe('PUT /api/v2/referenda/{index}/votes/me', () => {
	it('returns frozen shape `{ vote, stats }`', async () => {
		const vote = makeVote();
		const stats = makeStats({ ayePoints: 100, totalVoters: 1, ayeVoters: 1, nayPoints: 0, nayVoters: 0, abstainPoints: 0, abstainVoters: 0 });
		mocks.upsertVote.mockResolvedValue({ vote, stats });
		const res = await mePUT(
			req(meUrl, {
				method: 'PUT',
				headers: { 'content-type': JSON_CONTENT_TYPE },
				body: JSON.stringify({ decision: ReferendumDecision.AYE, pointsUsed: 100 })
			}),
			ctx('1')
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Object.keys(body).sort()).toEqual(['stats', 'vote']);
		expect(body.vote.decision).toBe('aye');
		expect(body.vote.uid).toBe('uid-1');
		expect(body.stats).toEqual(toReferendumStatsDto(stats));
	});

	it('maps insufficient balance to 403', async () => {
		mocks.upsertVote.mockRejectedValue(new ReferendaServiceError('insufficient-balance', 'You cannot use more than your current points balance (10).'));
		const res = await mePUT(
			req(meUrl, {
				method: 'PUT',
				headers: { 'content-type': JSON_CONTENT_TYPE },
				body: JSON.stringify({ decision: 'aye', pointsUsed: 100 })
			}),
			ctx('1')
		);
		expect(res.status).toBe(403);
	});

	it('maps outside-window to 409 and invalid amount to 400', async () => {
		mocks.upsertVote.mockRejectedValueOnce(new ReferendaServiceError('outside-voting-window', 'Voting has ended.'));
		const res409 = await mePUT(
			req(meUrl, {
				method: 'PUT',
				headers: { 'content-type': JSON_CONTENT_TYPE },
				body: JSON.stringify({ decision: 'aye', pointsUsed: 10 })
			}),
			ctx('1')
		);
		expect(res409.status).toBe(409);

		mocks.upsertVote.mockRejectedValueOnce(new ReferendaServiceError('invalid-argument', 'pointsUsed must be an integer.'));
		const res400 = await mePUT(
			req(meUrl, {
				method: 'PUT',
				headers: { 'content-type': JSON_CONTENT_TYPE },
				body: JSON.stringify({ decision: 'aye', pointsUsed: 1.5 })
			}),
			ctx('1')
		);
		expect(res400.status).toBe(400);
	});
});
describe('DELETE /api/v2/referenda/{index}/votes/me', () => {
	it('returns frozen shape `{ removed: true, stats }`', async () => {
		const stats = makeStats({ totalVoters: 5 });
		mocks.removeVote.mockResolvedValue(stats);
		const res = await meDELETE(req(meUrl, { method: 'DELETE' }), ctx('1'));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ removed: true, stats: toReferendumStatsDto(stats) });
	});

	it('maps non-Deciding removal to 409', async () => {
		mocks.removeVote.mockRejectedValue(new ReferendaServiceError('not-deciding', 'Voting is only allowed while the referendum is Deciding.'));
		const res = await meDELETE(req(meUrl, { method: 'DELETE' }), ctx('1'));
		expect(res.status).toBe(409);
	});
});

describe('GET /api/v2/referenda/{index}/votes (public history)', () => {
	it('returns privacy-safe public DTOs and the real totalCount', async () => {
		const vote = makeVote();
		mocks.getByIndex.mockResolvedValue(makeReferendum());
		mocks.listVotes.mockResolvedValue([vote]);
		mocks.countVotes.mockResolvedValue(7);
		const res = await historyGET(req('/api/v2/referenda/1/votes'), ctx('1'));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.totalCount).toBe(7);
		expect(body.items).toEqual([toPublicReferendumVoteDto(vote)]);
		const serialized = JSON.stringify(body);
		expect(serialized).not.toContain('"uid"');
		expect(serialized).not.toContain('"balanceAtVote"');
		expect(serialized).not.toContain('uid-1');
	});

	it('returns 404 when the referendum does not exist', async () => {
		mocks.getByIndex.mockResolvedValue(null);
		const res = await historyGET(req('/api/v2/referenda/999/votes'), ctx('999'));
		expect(res.status).toBe(404);
	});
});

describe('GET /referenda/admin/overview (admin operations panel)', () => {
	const overview = {
		statusCounts: { Submitted: 1, Deciding: 2, Confirmed: 3, Rejected: 4, Cancelled: 0 },
		totalReferenda: 10,
		recent: []
	};

	it('returns 401 for anonymous callers', async () => {
		mocks.requireVerifiedActor.mockRejectedValue(new ReferendaServiceError('unauthorized', UNAUTHORIZED_MESSAGE));
		const res = await adminOverviewGET(req(ADMIN_OVERVIEW_URL));
		expect(res.status).toBe(401);
	});

	it('returns 403 for authenticated non-admins', async () => {
		mocks.requireVerifiedActor.mockResolvedValue({ uid: 'u1', displayName: 'User' });
		mocks.isAdminActor.mockResolvedValue(false);
		const res = await adminOverviewGET(req(ADMIN_OVERVIEW_URL));
		expect(res.status).toBe(403);
	});

	it('returns the overview DTO for admins', async () => {
		mocks.requireVerifiedActor.mockResolvedValue({ uid: 'admin-1', displayName: 'Admin' });
		mocks.isAdminActor.mockResolvedValue(true);
		mocks.getAdminOverview.mockResolvedValue(overview);
		const res = await adminOverviewGET(req(ADMIN_OVERVIEW_URL));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.totalReferenda).toBe(10);
		expect(body.statusCounts.Deciding).toBe(2);
		expect(Array.isArray(body.recent)).toBe(true);
	});
});
