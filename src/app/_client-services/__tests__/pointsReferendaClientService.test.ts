// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Unit tests for the unified points Referenda client service (plan PR-5).
 * Fetch and Firebase auth are mocked; DTO validation, URL building, auth
 * headers, response.ok handling and error parsing are covered.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, max-classes-per-file, no-await-in-loop */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
	user: null as null | { uid: string; getIdToken: () => Promise<string> }
}));

vi.mock('firebase/auth', () => ({
	onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
		cb(h.user);
		return () => undefined;
	}
}));

vi.mock('@/app/_client-services/firebase/firebaseClientApp', () => ({
	clientAuth: {
		get currentUser() {
			return h.user;
		}
	}
}));

// eslint-disable-next-line import/first
import { type ReferendumDecision } from '@/domain/entities/Referendum';
// eslint-disable-next-line import/first
import {
	createPointsReferendum,
	fetchMyVote,
	fetchPointsReferendaList,
	fetchPointsReferendumDetail,
	fetchPointsReferendumStats,
	fetchPublicVotes,
	PointsReferendaApiError,
	publicVoteDtoFromJson,
	removeMyVote,
	statsDtoFromSnapshotData,
	upsertMyVote,
	voteDtoFromJson
} from '../points_referenda_client_service';

function mockFetchOnce(status: number, body: unknown): ReturnType<typeof vi.fn> {
	const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
	vi.stubGlobal('fetch', fn);
	return fn;
}

const TS = '2026-01-01T00:00:00.000Z';
const VALID_VOTE = {
	uid: 'u1',
	voterDisplayName: 'Alice',
	decision: 'aye',
	pointsUsed: 25,
	balanceAtVote: 100,
	createdAt: TS,
	updatedAt: TS
};

const VALID_STATS = {
	ayePoints: 60,
	nayPoints: 40,
	abstainPoints: 10,
	ayeVoters: 2,
	nayVoters: 1,
	abstainVoters: 1,
	totalVoters: 4,
	approvalBps: 6000,
	participatingPoints: 100,
	updatedAt: TS
};

beforeEach(() => {
	h.user = null;
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('DTO runtime validation', () => {
	it('accepts a valid vote and rejects unknown decisions', () => {
		expect(voteDtoFromJson(VALID_VOTE)?.uid).toBe('u1');
		expect(voteDtoFromJson({ ...VALID_VOTE, decision: 'split' })).toBeNull();
	});

	it('rejects votes with negative, fractional or missing points', () => {
		expect(voteDtoFromJson({ ...VALID_VOTE, pointsUsed: -1 })).toBeNull();
		expect(voteDtoFromJson({ ...VALID_VOTE, pointsUsed: 1.5 })).toBeNull();
		expect(voteDtoFromJson({ ...VALID_VOTE, pointsUsed: '25' })).toBeNull();
	});

	it('rejects votes with invalid dates', () => {
		expect(voteDtoFromJson({ ...VALID_VOTE, updatedAt: 'not-a-date' })).toBeNull();
	});

	it('rejects public votes carrying uid or balanceAtVote shape errors', () => {
		expect(publicVoteDtoFromJson({ voterDisplayName: 'A', decision: 'nay', pointsUsed: 5, createdAt: TS, updatedAt: TS })?.pointsUsed).toBe(5);
		expect(publicVoteDtoFromJson({ ...VALID_VOTE, pointsUsed: undefined })).toBeNull();
	});

	it('maps Firestore snapshot data (Timestamp → ISO) for the realtime listener', () => {
		const snapshotData = {
			...VALID_STATS,
			updatedAt: { toDate: () => new Date('2026-02-03T04:05:06.000Z') }
		};
		const dto = statsDtoFromSnapshotData(snapshotData as any);
		expect(dto?.updatedAt).toBe('2026-02-03T04:05:06.000Z');
		expect(dto?.participatingPoints).toBe(100);
	});

	it('returns null when a snapshot lacks numeric fields', () => {
		expect(statsDtoFromSnapshotData({ ayePoints: 'x' } as any)).toBeNull();
	});
});

describe('list endpoint', () => {
	it('builds the URL with page/pageSize/status/origin and parses the payload', async () => {
		const payload = {
			items: [
				{
					index: 1,
					title: 'T',
					authorUid: 'a',
					authorDisplayName: 'A',
					origin: 'root',
					status: 'Deciding',
					tags: [],
					votingStartsAt: TS,
					votingEndsAt: '2026-02-01T00:00:00.000Z',
					approvalThresholdBps: 5000,
					minimumTurnoutPoints: 1,
					createdAt: TS
				}
			],
			totalCount: 1,
			page: 2,
			pageSize: 10
		};
		const fn = mockFetchOnce(200, payload);
		const dto = await fetchPointsReferendaList({ page: 2, pageSize: 10, statuses: ['Deciding'], origin: 'root' });
		expect(String(fn.mock.calls[0][0])).toBe('/api/v2/referenda?page=2&pageSize=10&status=Deciding&origin=root');
		expect(dto.items).toHaveLength(1);
		expect(dto.totalCount).toBe(1);
	});

	it('throws PointsReferendaApiError with the server message on failure', async () => {
		mockFetchOnce(500, { message: 'Internal server error.' });
		await expect(fetchPointsReferendaList({ page: 1, pageSize: 10 })).rejects.toMatchObject({ status: 500, message: 'Internal server error.' });
	});

	it('rejects malformed list payloads (bad item shape)', async () => {
		mockFetchOnce(200, { items: [{ index: 'one' }], totalCount: 1, page: 1, pageSize: 10 });
		await expect(fetchPointsReferendaList({ page: 1, pageSize: 10 })).rejects.toBeInstanceOf(PointsReferendaApiError);
	});
});

describe('detail and stats endpoints', () => {
	const DETAIL = {
		index: 3,
		title: 'T',
		content: 'C',
		authorUid: 'a',
		authorDisplayName: 'A',
		origin: 'root',
		status: 'Deciding',
		tags: [],
		votingStartsAt: TS,
		votingEndsAt: '2026-02-01T00:00:00.000Z',
		approvalThresholdBps: 5000,
		minimumTurnoutPoints: 1,
		createdAt: TS,
		updatedAt: TS,
		schemaVersion: 1
	};

	it('returns null ONLY on 404', async () => {
		mockFetchOnce(404, { message: 'Referendum not found.' });
		expect(await fetchPointsReferendumDetail(999)).toBeNull();
	});

	it('throws with the parsed message on 500 and rejects malformed bodies on 200', async () => {
		mockFetchOnce(500, { message: 'boom' });
		await expect(fetchPointsReferendumDetail(3)).rejects.toMatchObject({ status: 500, message: 'boom' });
		mockFetchOnce(200, { hello: 'world' });
		await expect(fetchPointsReferendumDetail(3)).rejects.toBeInstanceOf(PointsReferendaApiError);
	});

	it('stats returns null on 404 and validates payloads', async () => {
		mockFetchOnce(404, { message: 'nf' });
		expect(await fetchPointsReferendumStats(999)).toBeNull();
		mockFetchOnce(200, VALID_STATS);
		expect((await fetchPointsReferendumStats(3))?.ayePoints).toBe(60);
		expect(DETAIL.content).toBe('C');
	});
});

describe('own-vote endpoint', () => {
	it('returns null WITHOUT calling fetch when anonymous', async () => {
		const fn = mockFetchOnce(200, {});
		expect(await fetchMyVote(1)).toBeNull();
		expect(fn).not.toHaveBeenCalled();
	});

	it('includes the ID token header and unwraps { vote } for logged-in users', async () => {
		h.user = { uid: 'u1', getIdToken: () => Promise.resolve('tok-123') };
		const fn = mockFetchOnce(200, { vote: VALID_VOTE });
		expect((await fetchMyVote(1))?.pointsUsed).toBe(25);
		const init = fn.mock.calls[0][1] as { headers: Record<string, string> };
		expect(init.headers.Authorization).toBe('Bearer tok-123');
	});

	it('never treats an error body as a vote (validation + 401 surface)', async () => {
		h.user = { uid: 'u1', getIdToken: () => Promise.resolve('tok') };
		mockFetchOnce(200, { message: 'you are not logged in' });
		expect(await fetchMyVote(1)).toBeNull(); // malformed { message } → null, never a vote
		mockFetchOnce(401, { message: 'unauthorized' });
		await expect(fetchMyVote(1)).rejects.toMatchObject({ status: 401 });
	});
});

describe('public votes endpoint', () => {
	it('parses privacy-safe entries and rejects malformed ones', async () => {
		mockFetchOnce(200, {
			items: [{ voterDisplayName: 'A', decision: 'abstain', pointsUsed: 3, createdAt: TS, updatedAt: TS }],
			totalCount: 7
		});
		const page = await fetchPublicVotes(1);
		expect(page.totalCount).toBe(7);
		expect(page.items[0].decision).toBe('abstain');
		mockFetchOnce(200, {
			items: [{ uid: 'leak', voterDisplayName: 'A', decision: 'aye', pointsUsed: 3, createdAt: TS, updatedAt: TS }],
			totalCount: 1
		});
		await expect(fetchPublicVotes(1)).rejects.toBeInstanceOf(PointsReferendaApiError);
	});
});

describe('mutations', () => {
	it('create posts to /api/v2/referenda with auth + JSON and unwraps { referendum }', async () => {
		h.user = { uid: 'u1', getIdToken: () => Promise.resolve('tok') };
		const detail = {
			index: 9,
			title: 'T',
			content: 'C',
			authorUid: 'u1',
			authorDisplayName: 'A',
			origin: 'root',
			status: 'Submitted',
			tags: [],
			votingStartsAt: '2026-03-01T00:00:00.000Z',
			votingEndsAt: '2026-04-01T00:00:00.000Z',
			approvalThresholdBps: 5000,
			minimumTurnoutPoints: 1,
			createdAt: TS,
			updatedAt: TS,
			schemaVersion: 1
		};
		const fn = mockFetchOnce(201, { referendum: detail });
		const dto = await createPointsReferendum({
			title: 'T',
			content: 'C',
			origin: 'root',
			votingStartsAt: '2026-03-01T00:00:00.000Z',
			votingEndsAt: '2026-04-01T00:00:00.000Z',
			approvalThresholdBps: 5000,
			minimumTurnoutPoints: 1
		});
		expect(dto.index).toBe(9);
		const [url, init] = fn.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
		expect(url).toBe('/api/v2/referenda');
		expect(init.method).toBe('POST');
		expect(init.headers.Authorization).toBe('Bearer tok');
	});

	it('upsert PUT parses { vote, stats } and rejects malformed responses', async () => {
		h.user = { uid: 'u1', getIdToken: () => Promise.resolve('tok') };
		const fn = mockFetchOnce(200, { vote: VALID_VOTE, stats: VALID_STATS });
		const { vote, stats } = await upsertMyVote(1, VALID_VOTE.decision as ReferendumDecision, 25);
		expect(vote.uid).toBe('u1');
		expect(stats.participatingPoints).toBe(100);
		expect((fn.mock.calls[0][1] as { method: string }).method).toBe('PUT');
		mockFetchOnce(200, { vote: VALID_VOTE });
		await expect(upsertMyVote(1, VALID_VOTE.decision as ReferendumDecision, 25)).rejects.toBeInstanceOf(PointsReferendaApiError);
	});

	it('remove DELETE parses { removed, stats } → stats', async () => {
		h.user = { uid: 'u1', getIdToken: () => Promise.resolve('tok') };
		const fn = mockFetchOnce(200, { removed: true, stats: VALID_STATS });
		expect((await removeMyVote(1)).totalVoters).toBe(4);
		expect((fn.mock.calls[0][1] as { method: string }).method).toBe('DELETE');
	});
});
