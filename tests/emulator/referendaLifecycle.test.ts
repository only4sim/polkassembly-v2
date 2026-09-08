// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Lifecycle processor emulator tests (plan PR-4 / Phase 3).
 *
 * Exercises the compiled Cloud Functions handler (`functions/lib/lifecycle.js`)
 * directly with an INJECTED clock — no Pub/Sub emulator or scheduler trigger is
 * needed. Also cross-checks the Functions outcome formula against the Next.js
 * domain implementation on identical inputs (conformance guard).
 *
 * Prerequisite: `cd functions && npm run build` (wired into `yarn test:emulators`).
 */

/* eslint-disable no-await-in-loop, no-restricted-syntax */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { ReferendumDecision, ReferendumStatus } from '@/domain/entities/Referendum';
import { computeFinalOutcome } from '@/domain/services/referendumOutcome';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-referenda-lifecycle';

// IMPORTANT: each emulator test file MUST use its own projectId. The emulator
// supports arbitrary projects, while `testEnv.cleanup()` wipes the project it
// was initialized with — sharing one projectId across files lets one file's
// cleanup delete another file's documents mid-run (observed in PR-4).
const PROJECT_ID = 'demo-referenda-lifecycle';
const HOUR = 60 * 60 * 1000;

let testEnv: RulesTestEnvironment;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lifecycle: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let functionsTimestamp: any;

beforeAll(async () => {
	const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
	testEnv = await initializeTestEnvironment({
		projectId: PROJECT_ID,
		firestore: { host: '127.0.0.1', port: 8080 }
	});
	// Load the compiled CommonJS Functions module through Node's require so the
	// vite transform pipeline never touches the functions build output.
	const requireFn = createRequire(import.meta.url);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	lifecycle = requireFn('../../functions/lib/lifecycle.js') as any;
	// IMPORTANT: the db handle MUST come from the Functions' own firebase-admin
	// copy — mixing Timestamp instances across firebase-admin copies breaks the
	// Firestore query validators inside the handler.
	const requireFromFunctions = createRequire(require.resolve('../../functions/lib/lifecycle.js'));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const functionsAdmin: any = requireFromFunctions('firebase-admin');
	if (!functionsAdmin.apps.length) {
		functionsAdmin.initializeApp({ projectId: PROJECT_ID });
	}
	adminDb = functionsAdmin.firestore();
	functionsTimestamp = functionsAdmin.firestore.Timestamp;
});

afterAll(async () => {
	await testEnv.cleanup();
});

// NOTE (PR-4): there is deliberately NO beforeEach clearFirestore here. The
// emulator's bulk delete is asynchronous and races with the tests' own queries
// and writes (observed: ghost documents re-processed, documents vanishing).
// Instead every test seeds UNIQUE document indexes and leaves all of its
// documents in a non-matchable state (final or skipped), so tests are
// deterministic without clearing.

async function seedReferendum(
	index: number,
	opts: {
		status: ReferendumStatus;
		startsAt: Date;
		endsAt: Date;
		ayePoints?: number;
		nayPoints?: number;
		abstainPoints?: number;
		approvalThresholdBps?: number;
		minimumTurnoutPoints?: number;
	}
): Promise<void> {
	await adminDb
		.collection('referenda')
		.doc(String(index))
		.set({
			index,
			title: `Lifecycle referendum ${index}`,
			content: 'Seeded by the lifecycle integration test.',
			authorUid: 'author-1',
			authorDisplayName: 'Author',
			origin: 'root',
			status: opts.status,
			tags: [],
			votingStartsAt: functionsTimestamp.fromDate(opts.startsAt),
			votingEndsAt: functionsTimestamp.fromDate(opts.endsAt),
			approvalThresholdBps: opts.approvalThresholdBps ?? 5000,
			minimumTurnoutPoints: opts.minimumTurnoutPoints ?? 1,
			createdAt: functionsTimestamp.now(),
			updatedAt: functionsTimestamp.now(),
			schemaVersion: 1
		});
	await adminDb
		.collection('referenda')
		.doc(String(index))
		.collection('stats')
		.doc('current')
		.set({
			ayePoints: opts.ayePoints ?? 0,
			nayPoints: opts.nayPoints ?? 0,
			abstainPoints: opts.abstainPoints ?? 0,
			ayeVoters: opts.ayePoints ? 1 : 0,
			nayVoters: opts.nayPoints ? 1 : 0,
			abstainVoters: opts.abstainPoints ? 1 : 0,
			totalVoters: (opts.ayePoints ? 1 : 0) + (opts.nayPoints ? 1 : 0) + (opts.abstainPoints ? 1 : 0),
			updatedAt: functionsTimestamp.now(),
			schemaVersion: 1
		});
}

async function readStatus(index: number): Promise<string | null> {
	const snap = await adminDb.collection('referenda').doc(String(index)).get();
	return snap.exists ? ((snap.data()?.status as string) ?? null) : null;
}

/**
 * Unique per-test indexes (PR-2/PR-4 hardening): document IDs never collide
 * across tests, so a racing clearFirestore cannot merge or wipe documents and
 * every test's assertions are deterministic.
 */
let seq = 100;
const nextIndex = (): number => {
	seq += 1;
	return seq;
};
describe('lifecycle: Submitted transitions', () => {
	it('leaves a future-start Submitted referendum untouched', async () => {
		const idx = nextIndex();
		await seedReferendum(idx, { status: ReferendumStatus.Submitted, startsAt: new Date(Date.now() + 30 * 24 * HOUR), endsAt: new Date(Date.now() + 60 * 24 * HOUR) });
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(result.opened).toBe(0);
		expect(result.rejectedExpired).toBe(0);
		expect(await readStatus(idx)).toBe('Submitted');
	});

	it('opens a Submitted referendum at exactly its start instant', async () => {
		const idx = nextIndex();
		const start = new Date(Date.now() - 1000);
		await seedReferendum(idx, { status: ReferendumStatus.Submitted, startsAt: start, endsAt: new Date(Date.now() + 30 * 24 * HOUR) });
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(result.opened).toBe(1);
		expect(await readStatus(idx)).toBe('Deciding');
	});

	it('rejects a Submitted referendum whose window already expired', async () => {
		const idx = nextIndex();
		await seedReferendum(idx, { status: ReferendumStatus.Submitted, startsAt: new Date(Date.now() - 48 * HOUR), endsAt: new Date(Date.now() - 1000) });
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(result.rejectedExpired).toBe(1);
		expect(await readStatus(idx)).toBe('Rejected');
	});
});

describe('lifecycle: Deciding finalization', () => {
	it('finalizes an expired Deciding referendum as Confirmed on majority approval', async () => {
		const idx = nextIndex();
		await seedReferendum(idx, {
			status: ReferendumStatus.Deciding,
			startsAt: new Date(Date.now() - 48 * HOUR),
			endsAt: new Date(Date.now() - 1000),
			ayePoints: 600,
			nayPoints: 400
		});
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(result.finalized).toBeGreaterThanOrEqual(1);
		expect(await readStatus(idx)).toBe('Confirmed');
	});

	it('finalizes an expired Deciding referendum as Rejected on minority approval', async () => {
		const idx = nextIndex();
		await seedReferendum(idx, {
			status: ReferendumStatus.Deciding,
			startsAt: new Date(Date.now() - 48 * HOUR),
			endsAt: new Date(Date.now() - 1000),
			ayePoints: 400,
			nayPoints: 600
		});
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(result.finalized).toBeGreaterThanOrEqual(1);
		expect(await readStatus(idx)).toBe('Rejected');
	});

	it('rejects an expired referendum with only abstentions (zero approval denominator)', async () => {
		const idx = nextIndex();
		await seedReferendum(idx, {
			status: ReferendumStatus.Deciding,
			startsAt: new Date(Date.now() - 48 * HOUR),
			endsAt: new Date(Date.now() - 1000),
			abstainPoints: 500
		});
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(result.finalized).toBeGreaterThanOrEqual(1);
		expect(await readStatus(idx)).toBe('Rejected');
	});

	it('passes at the exact cross-multiplied threshold (conformance with the domain algorithm)', async () => {
		const idx = nextIndex();
		// exact: 100 * 10000 >= 5000 * 200 -> 1,000,000 >= 1,000,000 -> pass
		await seedReferendum(idx, {
			status: ReferendumStatus.Deciding,
			startsAt: new Date(Date.now() - 48 * HOUR),
			endsAt: new Date(Date.now() - 1000),
			ayePoints: 100,
			nayPoints: 100,
			approvalThresholdBps: 5000
		});
		// Conformance guard: the Functions formula and the domain formula must agree.
		const stats = { ayePoints: 100, nayPoints: 100, abstainPoints: 0 };
		expect(lifecycle.computeFinalOutcomeExact(5000, 1, stats)).toBe(
			computeFinalOutcome(5000, 1, {
				...stats,
				ayeVoters: 1,
				nayVoters: 1,
				abstainVoters: 0,
				totalVoters: 2,
				updatedAt: '',
				schemaVersion: 1
			}).outcome
		);
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(result.finalized).toBeGreaterThanOrEqual(1);
		expect(await readStatus(idx)).toBe('Confirmed');
	});

	it('rejects below the exact cross-multiplied threshold even when the rounded bps would pass', async () => {
		const idx = nextIndex();
		// exact: 1 * 10000 >= 1667 * 6 -> 10000 >= 10002 -> reject (rounded would say 1667 >= 1667)
		await seedReferendum(idx, {
			status: ReferendumStatus.Deciding,
			startsAt: new Date(Date.now() - 48 * HOUR),
			endsAt: new Date(Date.now() - 1000),
			ayePoints: 1,
			nayPoints: 5,
			approvalThresholdBps: 1667
		});
		await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(await readStatus(idx)).toBe('Rejected');
	});
});

describe('lifecycle: idempotency, cancellation and ordering', () => {
	it('is idempotent: a repeated run performs no further transitions', async () => {
		const idx = nextIndex();
		await seedReferendum(idx, {
			status: ReferendumStatus.Deciding,
			startsAt: new Date(Date.now() - 48 * HOUR),
			endsAt: new Date(Date.now() - 1000),
			ayePoints: 600,
			nayPoints: 400
		});
		const now = new Date();
		const first = await lifecycle.processReferendaLifecycle(adminDb, now);
		expect(first.finalized).toBeGreaterThanOrEqual(1);
		const second = await lifecycle.processReferendaLifecycle(adminDb, now);
		// Idempotent in effect: the repeated run performs no further transitions,
		// and re-processing writes the same final status.
		expect(second.finalized).toBe(0);
		expect(await readStatus(idx)).toBe('Confirmed');
	});

	it('leaves Cancelled referenda untouched (admin cancellation wins)', async () => {
		const idx = nextIndex();
		await seedReferendum(idx, {
			status: ReferendumStatus.Cancelled,
			startsAt: new Date(Date.now() - 48 * HOUR),
			endsAt: new Date(Date.now() - 1000),
			ayePoints: 600,
			nayPoints: 400
		});
		await lifecycle.processReferendaLifecycle(adminDb, new Date());
		expect(await readStatus(idx)).toBe('Cancelled');
	});

	it('processes more than one batch when batchSize is smaller than the backlog', async () => {
		const now = new Date();
		const expired = { startsAt: new Date(now.getTime() - 48 * HOUR), endsAt: new Date(now.getTime() - 1000) };
		const ids: number[] = [];
		for (let i = 1; i <= 5; i += 1) {
			const idx = nextIndex();
			ids.push(idx);
			await seedReferendum(idx, { status: ReferendumStatus.Deciding, ...expired, ayePoints: 600, nayPoints: 400 });
		}
		const result = await lifecycle.processReferendaLifecycle(adminDb, now, { batchSize: 2 });
		expect(result.finalized).toBeGreaterThanOrEqual(5);
		for (const idx of ids) {
			expect(await readStatus(idx)).toBe('Confirmed');
		}
	});

	it('counts a vote that was cast before finalization', async () => {
		const end = new Date(Date.now() + 24 * HOUR);
		await seedReferendum(1, { status: ReferendumStatus.Deciding, startsAt: new Date(Date.now() - 24 * HOUR), endsAt: end, minimumTurnoutPoints: 1 });
		const svcMod = await import('@/app/api/_api-services/referenda/referendumTrustedService');
		const svc = new svcMod.ReferendumTrustedService();
		await adminDb.collection('users').doc('voter-1').set({
			uid: 'voter-1',
			email: '',
			displayName: 'Voter',
			role: 'user',
			pointsBalance: 1000,
			createdAt: functionsTimestamp.now(),
			updatedAt: functionsTimestamp.now()
		});
		await svc.upsertVote(1, { uid: 'voter-1', displayName: 'Voter' }, { decision: ReferendumDecision.AYE, pointsUsed: 100 });

		// The injected clock moves past the end instant; the earlier vote is counted.
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date(end.getTime() + 1000));
		expect(result.finalized).toBeGreaterThanOrEqual(1);
		expect(await readStatus(1)).toBe('Confirmed');
		const stats = await adminDb.collection('referenda').doc('1').collection('stats').doc('current').get();
		expect(stats.data()?.ayePoints).toBe(100);
	});

	it('rejects a vote attempted after finalization (closed status contract)', async () => {
		const end = new Date(Date.now() + 24 * HOUR);
		await seedReferendum(1, { status: ReferendumStatus.Deciding, startsAt: new Date(Date.now() - 24 * HOUR), endsAt: end, minimumTurnoutPoints: 1 });
		await adminDb.collection('users').doc('voter-1').set({
			uid: 'voter-1',
			email: '',
			displayName: 'Voter',
			role: 'user',
			pointsBalance: 1000,
			createdAt: functionsTimestamp.now(),
			updatedAt: functionsTimestamp.now()
		});
		const svcMod = await import('@/app/api/_api-services/referenda/referendumTrustedService');
		const svc = new svcMod.ReferendumTrustedService();

		// Finalize first (injected clock after the end instant)...
		const result = await lifecycle.processReferendaLifecycle(adminDb, new Date(end.getTime() + 1000));
		expect(result.finalized).toBeGreaterThanOrEqual(1);
		// ...then the late vote must be rejected by the not-Deciding contract.
		await expect(svc.upsertVote(1, { uid: 'voter-1', displayName: 'Voter' }, { decision: ReferendumDecision.AYE, pointsUsed: 100 })).rejects.toMatchObject({
			code: 'not-deciding'
		});
	});
});
