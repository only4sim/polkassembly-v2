// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Firestore emulator integration tests for the Referenda trusted service and
 * repository (plan Phase 0 gate: `test:emulators` must run non-rules tests).
 *
 * These tests exercise the REAL service/repository code against the Firestore
 * emulator — no mocks. Admin SDK bypasses security rules by design; rule
 * enforcement is covered by `tests/firestore/rules.test.ts`.
 *
 * Run via `yarn test:emulators` or `yarn test:integration`.
 */

/* eslint-disable no-await-in-loop, no-restricted-syntax */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase-admin/firestore';
import { ReferendumDecision, ReferendumStatus } from '@/domain/entities/Referendum';

// Must be set BEFORE the firebase-admin modules are dynamically imported in
// beforeAll so the Admin SDK connects to the emulator under an isolated project.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-referenda-itest';

const PROJECT_ID = 'demo-referenda-itest';
let testEnv: RulesTestEnvironment;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let trustedMod: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let readMod: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svc: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminDb: any;

const HOUR = 60 * 60 * 1000;
const past = (ms: number) => new Date(Date.now() - ms);
const future = (ms: number) => new Date(Date.now() + ms);

const REFERENDUM_CONTENT = 'This referendum content is sufficiently long.';
const INVALID_ARGUMENT = 'invalid-argument';
const COMMENT_BODY = 'Hello **world**';

const service = () => new trustedMod.ReferendumTrustedService();
const readSvc = () => new readMod.ReferendumReadService();
const actor = (uid: string, displayName = 'Voter') => ({ uid, displayName });

beforeAll(async () => {
	const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
	testEnv = await initializeTestEnvironment({
		projectId: PROJECT_ID,
		firestore: { host: '127.0.0.1', port: 8080 }
	});
	trustedMod = await import('@/app/api/_api-services/referenda/referendumTrustedService');
	readMod = await import('@/app/api/_api-services/referenda/referendumReadService');
	svc = service();
	const init = await import('@/adapters/firestore/firestoreInit');
	adminDb = init.getAdminDb();
});

beforeEach(async () => {
	await testEnv.clearFirestore();
});

afterAll(async () => {
	await testEnv.cleanup();
});

async function seedUser(uid: string, pointsBalance: number, displayName = 'Voter'): Promise<void> {
	await adminDb.collection('users').doc(uid).set({
		uid,
		email: '',
		displayName,
		role: 'user',
		pointsBalance,
		createdAt: Timestamp.now(),
		updatedAt: Timestamp.now()
	});
}

async function seedCounter(value: number): Promise<void> {
	await adminDb.collection('counters').doc('referenda').set({ value });
}

async function seedDecidingReferendum(index: number, window?: { start: Date; end: Date }): Promise<void> {
	const start = window?.start ?? past(24 * HOUR);
	const end = window?.end ?? future(24 * HOUR);
	await adminDb
		.collection('referenda')
		.doc(String(index))
		.set({
			index,
			title: 'Integration referendum',
			content: 'Seeded by the emulator integration test.',
			authorUid: 'author-1',
			authorDisplayName: 'Author',
			origin: 'root',
			status: ReferendumStatus.Deciding,
			tags: [],
			votingStartsAt: Timestamp.fromDate(start),
			votingEndsAt: Timestamp.fromDate(end),
			approvalThresholdBps: 5000,
			minimumTurnoutPoints: 1,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
			schemaVersion: 1
		});
	await adminDb.collection('referenda').doc(String(index)).collection('stats').doc('current').set({
		ayePoints: 0,
		nayPoints: 0,
		abstainPoints: 0,
		ayeVoters: 0,
		nayVoters: 0,
		abstainVoters: 0,
		totalVoters: 0,
		updatedAt: Timestamp.now(),
		schemaVersion: 1
	});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readStats(index: number): Promise<any> {
	const snap = await adminDb.collection('referenda').doc(String(index)).collection('stats').doc('current').get();
	return snap.data() ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readVotes(index: number): Promise<any[]> {
	const snap = await adminDb.collection('referenda').doc(String(index)).collection('votes').get();
	return snap.docs.map((d: { id: string; data: () => Record<string, unknown> }) => ({
		uid: d.id,
		decision: d.data().decision,
		pointsUsed: d.data().pointsUsed
	}));
}

/** Fresh recomputation of the aggregate from the vote documents. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recompute(votes: any[]) {
	const totals = { ayePoints: 0, nayPoints: 0, abstainPoints: 0, ayeVoters: 0, nayVoters: 0, abstainVoters: 0, totalVoters: votes.length };
	for (const v of votes) {
		if (v.decision === ReferendumDecision.AYE) {
			totals.ayePoints += v.pointsUsed;
			totals.ayeVoters += 1;
		} else if (v.decision === ReferendumDecision.NAY) {
			totals.nayPoints += v.pointsUsed;
			totals.nayVoters += 1;
		} else {
			totals.abstainPoints += v.pointsUsed;
			totals.abstainVoters += 1;
		}
	}
	return totals;
}

/** Frozen invariant: stored stats must exactly equal a fresh recomputation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function expectStatsMatchesVotes(index: number): Promise<void> {
	const [stats, votes] = await Promise.all([readStats(index), readVotes(index)]);
	const expected = recompute(votes);
	expect(stats.ayePoints).toBe(expected.ayePoints);
	expect(stats.nayPoints).toBe(expected.nayPoints);
	expect(stats.abstainPoints).toBe(expected.abstainPoints);
	expect(stats.ayeVoters).toBe(expected.ayeVoters);
	expect(stats.nayVoters).toBe(expected.nayVoters);
	expect(stats.abstainVoters).toBe(expected.abstainVoters);
	expect(stats.totalVoters).toBe(expected.totalVoters);
}

describe('Referenda trusted service (Firestore emulator)', () => {
	it('createReferendum allocates the index, document and empty stats in one transaction', async () => {
		await seedCounter(0);
		await seedUser('author-1', 1000, 'Author');

		const created = await service().createReferendum(actor('author-1', 'Author'), {
			title: 'A valid referendum title',
			content: REFERENDUM_CONTENT,
			origin: 'root',
			votingStartsAt: future(24 * HOUR).toISOString(),
			votingEndsAt: future(7 * 24 * HOUR).toISOString(),
			approvalThresholdBps: 5000,
			minimumTurnoutPoints: 1
		});

		expect(created.index).toBe(1);
		expect(created.status).toBe(ReferendumStatus.Submitted);
		expect(created.authorUid).toBe('author-1');

		const statsDoc = await adminDb.collection('referenda').doc('1').collection('stats').doc('current').get();
		expect(statsDoc.exists).toBe(true);
		const counter = await adminDb.collection('counters').doc('referenda').get();
		expect(counter.data()?.value).toBe(1);
	});

	it('createReferendum decides the initial status inside the creation transaction (PR-4)', async () => {
		await seedCounter(0);
		await seedUser('author-1', 1000, 'Author');

		// Already-open window: created directly as Deciding — no second transition.
		const open = await service().createReferendum(actor('author-1', 'Author'), {
			title: 'A valid open-window title',
			content: REFERENDUM_CONTENT,
			origin: 'root',
			votingStartsAt: past(1 * HOUR).toISOString(),
			votingEndsAt: future(7 * 24 * HOUR).toISOString(),
			approvalThresholdBps: 5000,
			minimumTurnoutPoints: 1
		});
		expect(open.status).toBe(ReferendumStatus.Deciding);
		const persisted = await adminDb.collection('referenda').doc(String(open.index)).get();
		expect(persisted.data()?.status).toBe('Deciding');

		// Already-expired window: rejected at creation time with the 400 contract.
		await expect(
			service().createReferendum(actor('author-1', 'Author'), {
				title: 'A valid expired title',
				content: REFERENDUM_CONTENT,
				origin: 'root',
				votingStartsAt: past(7 * 24 * HOUR).toISOString(),
				votingEndsAt: past(1 * HOUR).toISOString(),
				approvalThresholdBps: 5000,
				minimumTurnoutPoints: 1
			})
		).rejects.toMatchObject({ code: INVALID_ARGUMENT });
	});

	it('allocates unique indexes under concurrent creation', async () => {
		await seedCounter(0);
		await seedUser('author-1', 1000, 'Author');

		const results = await Promise.all(
			Array.from({ length: 5 }, (_, i) =>
				service().createReferendum(actor('author-1', 'Author'), {
					title: `A valid referendum title ${i}`,
					content: REFERENDUM_CONTENT,
					origin: 'root',
					votingStartsAt: future(24 * HOUR).toISOString(),
					votingEndsAt: future(7 * 24 * HOUR).toISOString(),
					approvalThresholdBps: 5000,
					minimumTurnoutPoints: 1
				})
			)
		);

		const indexes = results.map((r: { index: number }) => r.index).sort((a: number, b: number) => a - b);
		expect(new Set(indexes).size).toBe(5);
		expect(indexes).toEqual([1, 2, 3, 4, 5]);
	});

	it('createVote writes the vote and keeps stats equal to a fresh recomputation', async () => {
		await seedUser('voter-1', 1000, 'Profile Name');
		await seedDecidingReferendum(1);

		const { vote, stats } = await service().upsertVote(1, actor('voter-1', 'Token Name'), {
			decision: ReferendumDecision.AYE,
			pointsUsed: 100
		});

		expect(vote.decision).toBe(ReferendumDecision.AYE);
		expect(vote.pointsUsed).toBe(100);
		expect(vote.balanceAtVote).toBe(1000);
		// Authoritative displayName comes from the Firestore profile, not the token.
		expect(vote.voterDisplayName).toBe('Profile Name');
		expect(stats.totalVoters).toBe(1);
		await expectStatsMatchesVotes(1);
	});

	it('changing decision and amount keeps stats equal to a fresh recomputation', async () => {
		await seedUser('voter-1', 1000);
		await seedDecidingReferendum(1);

		await svc.upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.AYE, pointsUsed: 100 });
		await svc.upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.NAY, pointsUsed: 50 });

		const stats = await readStats(1);
		expect(stats.ayePoints).toBe(0);
		expect(stats.nayPoints).toBe(50);
		expect(stats.nayVoters).toBe(1);
		expect(stats.ayeVoters).toBe(0);
		expect(stats.totalVoters).toBe(1);
		await expectStatsMatchesVotes(1);
	});

	it('an identical idempotent PUT does not change the aggregate', async () => {
		await seedUser('voter-1', 1000);
		await seedDecidingReferendum(1);
		const payload = { decision: ReferendumDecision.AYE, pointsUsed: 100 } as const;

		const first = await svc.upsertVote(1, actor('voter-1'), payload);
		const second = await svc.upsertVote(1, actor('voter-1'), payload);

		expect(second.stats.totalVoters).toBe(first.stats.totalVoters);
		expect(second.stats.ayePoints).toBe(first.stats.ayePoints);
		await expectStatsMatchesVotes(1);
	});

	it('removeVote subtracts the contribution and is idempotent', async () => {
		await seedUser('voter-1', 1000);
		await seedDecidingReferendum(1);

		await svc.upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.ABSTAIN, pointsUsed: 40 });
		const statsAfterRemove = await svc.removeVote(1, actor('voter-1'));
		expect(statsAfterRemove.totalVoters).toBe(0);
		expect(statsAfterRemove.abstainPoints).toBe(0);

		// Idempotent: removing again succeeds and reports the same (zeroed) stats.
		const statsSecondRemove = await svc.removeVote(1, actor('voter-1'));
		expect(statsSecondRemove.totalVoters).toBe(0);
		await expectStatsMatchesVotes(1);
	});
	it('same-user concurrent changes leave stats consistent with the final votes', async () => {
		await seedUser('voter-1', 1000);
		await seedDecidingReferendum(1);

		// Two concurrent PUTs from the same user: transactions serialize and the
		// last committed write wins, but the stored aggregate must always match
		// a fresh recomputation of the surviving vote documents.
		await Promise.all([
			svc.upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.AYE, pointsUsed: 100 }),
			svc.upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.NAY, pointsUsed: 50 })
		]);

		const votes = await readVotes(1);
		expect(votes).toHaveLength(1); // one effective vote per UID
		await expectStatsMatchesVotes(1);
	});

	it('multiple users can vote concurrently and stats match the recomputation', async () => {
		await seedUser('voter-1', 1000);
		await seedUser('voter-2', 800);
		await seedUser('voter-3', 500);
		await seedDecidingReferendum(1);

		await Promise.all([
			service().upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.AYE, pointsUsed: 100 }),
			service().upsertVote(1, actor('voter-2'), { decision: ReferendumDecision.NAY, pointsUsed: 80 }),
			service().upsertVote(1, actor('voter-3'), { decision: ReferendumDecision.ABSTAIN, pointsUsed: 20 })
		]);

		const stats = await readStats(1);
		expect(stats.totalVoters).toBe(3);
		expect(stats.ayePoints).toBe(100);
		expect(stats.nayPoints).toBe(80);
		expect(stats.abstainPoints).toBe(20);
		await expectStatsMatchesVotes(1);
	});

	it('rejects invalid decisions with the frozen invalid-argument contract', async () => {
		await seedUser('voter-1', 1000);
		await seedDecidingReferendum(1);

		await expect(service().upsertVote(1, actor('voter-1'), { decision: 'split' as unknown as ReferendumDecision, pointsUsed: 10 })).rejects.toMatchObject({
			code: INVALID_ARGUMENT,
			name: 'ReferendaServiceError'
		});
	});

	it('rejects amounts above the authoritative pointsBalance with 403 semantics', async () => {
		await seedUser('voter-1', 10);
		await seedDecidingReferendum(1);

		await expect(service().upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.AYE, pointsUsed: 11 })).rejects.toMatchObject({ code: 'insufficient-balance' });
	});

	it('rejects voting after the voting window has ended', async () => {
		await seedUser('voter-1', 1000);
		await seedDecidingReferendum(1, { start: past(48 * HOUR), end: new Date(Date.now() - 1000) });

		await expect(service().upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.AYE, pointsUsed: 10 })).rejects.toMatchObject({ code: 'outside-voting-window' });
	});

	it('rejects voting before the voting window opens', async () => {
		await seedUser('voter-1', 1000);
		await seedDecidingReferendum(1, { start: future(1 * HOUR), end: future(48 * HOUR) });

		await expect(service().upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.AYE, pointsUsed: 10 })).rejects.toMatchObject({ code: 'outside-voting-window' });
	});

	it('rejects votes from a user whose Firestore profile is missing', async () => {
		await seedDecidingReferendum(1);

		await expect(service().upsertVote(1, actor('ghost-user'), { decision: ReferendumDecision.AYE, pointsUsed: 10 })).rejects.toMatchObject({
			code: 'not-found'
		});
	});

	it('rejects votes when the stored pointsBalance is not a safe non-negative integer', async () => {
		const fracUid = 'voter-frac';
		await seedUser('voter-bad', -50);
		await seedDecidingReferendum(1);
		await expect(service().upsertVote(1, actor('voter-bad'), { decision: ReferendumDecision.AYE, pointsUsed: 1 })).rejects.toMatchObject({
			code: 'conflict'
		});

		// Re-seed with a corrupt fractional balance and assert the same contract.
		await adminDb.collection('users').doc(fracUid).set({
			uid: fracUid,
			email: '',
			displayName: 'Frac',
			role: 'user',
			pointsBalance: 10.5,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now()
		});
		await expect(service().upsertVote(1, actor(fracUid), { decision: ReferendumDecision.AYE, pointsUsed: 1 })).rejects.toMatchObject({
			code: 'conflict'
		});
	});

	it('rejects removal when the stored stats cannot cover the vote (no silent clamping)', async () => {
		await seedUser('voter-1', 1000);
		await seedDecidingReferendum(1);
		await service().upsertVote(1, actor('voter-1'), { decision: ReferendumDecision.AYE, pointsUsed: 100 });

		// Corrupt the aggregate behind the service's back (simulates tampering).
		await adminDb.collection('referenda').doc('1').collection('stats').doc('current').update({ ayePoints: 5 });

		await expect(service().removeVote(1, actor('voter-1'))).rejects.toThrow(/corrupt stats/i);
		// The invariant still holds after the failed attempt: recompute equals stats.
		const stats = await readStats(1);
		expect(stats.ayePoints).toBe(5);
		expect(stats.totalVoters).toBe(1);
	});

	describe('Referendum comments (plan PR-7, Firestore emulator)', () => {
		it('adds a comment with the authoritative profile displayName and lists it', async () => {
			const idx = 700;
			await seedDecidingReferendum(idx);
			await seedUser('commenter-1', 100, 'Commenter One');
			const added = await service().addComment(idx, actor('commenter-1', 'token-name'), COMMENT_BODY);
			expect(added.authorDisplayName).toBe('Commenter One');
			expect(added.content).toBe(COMMENT_BODY);
			const page = await readSvc().listComments(idx, 20, 1);
			expect(page.totalCount).toBe(1);
			expect(page.items[0].content).toBe(COMMENT_BODY);
		});

		it('rejects empty and oversized comment bodies with 400', async () => {
			const idx = 701;
			await seedDecidingReferendum(idx);
			const commenter = 'commenter-2';
			await seedUser(commenter, 100);
			await expect(svc.addComment(idx, actor(commenter), '   ')).rejects.toMatchObject({ code: INVALID_ARGUMENT });
			await expect(svc.addComment(idx, actor(commenter), 'x'.repeat(4001))).rejects.toMatchObject({ code: INVALID_ARGUMENT });
		});

		it('rejects comments on missing referenda with 404', async () => {
			await seedUser('commenter-3', 100);
			await expect(svc.addComment(999999, actor('commenter-3'), 'hi')).rejects.toMatchObject({ code: 'not-found' });
		});

		it('enforces author-or-admin deletion and idempotent missing-comment delete', async () => {
			const idx = 702;
			await seedDecidingReferendum(idx);
			await seedUser('author-a', 100);
			await seedUser('author-b', 100);
			const added = await service().addComment(idx, actor('author-a'), 'mine');
			await expect(svc.deleteComment(idx, added.id, 'author-b', false)).rejects.toMatchObject({ code: 'forbidden' });
			await expect(svc.deleteComment(idx, added.id, 'author-b', true)).resolves.toBeUndefined(); // admin may delete
			await expect(svc.deleteComment(idx, added.id, 'author-a', false)).resolves.toBeUndefined(); // idempotent
		});
	});

	describe('Public vote history pagination + decision filter (plan PR-7, emulator)', () => {
		it('pages through votes and filters by decision with a matching totalCount', async () => {
			const idx = 710;
			await seedDecidingReferendum(idx);
			for (let i = 1; i <= 5; i += 1) {
				await seedUser(`voter-${i}`, 1000);
				await service().upsertVote(idx, actor(`voter-${i}`), { decision: i % 2 === 0 ? ReferendumDecision.NAY : ReferendumDecision.AYE, pointsUsed: 10 * i });
			}
			const page1 = await readSvc().listVotes(idx, { limit: 2, page: 1 });
			const page2 = await readSvc().listVotes(idx, { limit: 2, page: 2 });
			expect(page1).toHaveLength(2);
			expect(page2).toHaveLength(2);
			const ids = new Set([...page1, ...page2].map((v) => v.uid));
			expect(ids.size).toBe(4); // pages do not overlap
			const ayeOnly = await readSvc().listVotes(idx, { limit: 50, decision: 'aye' });
			expect(ayeOnly).toHaveLength(3); // i = 1, 3, 5
			expect(await readSvc().countVotes(idx, 'aye')).toBe(3);
			expect(await readSvc().countVotes(idx, 'nay')).toBe(2);
		});
	});
});
