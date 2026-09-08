// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Firestore security-rules attack/allow matrix (plan PR-2, section 8.5).
 *
 * Access model (frozen PR-2): ALL client writes are denied; every mutation goes
 * through the Admin SDK (trusted API routes / Cloud Functions) which bypasses
 * these rules. Client reads are minimal-privilege:
 *   - users/{uid}: owner only (email PII + role/pointsBalance)
 *   - posts/{id}/votes/{uid} and referenda/{index}/votes/{uid}: owner only
 *   - referenda docs/stats, posts docs/comments/stats: public read
 *   - counters: fully inaccessible
 * Note: rules intentionally have NO admin concept — privileged writes happen via
 * the Admin SDK which bypasses rules, so an "admin" client token has no power.
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setLogLevel, setDoc, updateDoc, where } from 'firebase/firestore';

setLogLevel('silent');

const PROJECT_ID = 'cbs-assembly';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
	testEnv = await initializeTestEnvironment({
		projectId: PROJECT_ID,
		firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
	});
});

afterAll(async () => {
	await testEnv.cleanup();
});

beforeEach(async () => {
	await testEnv.clearFirestore();
});

// Just under Firestore's ~1 MB document limit (and title+content combined stays
// under it too), so size validation does not preempt rules evaluation.
const HUGE = 'x'.repeat(300 * 1024);

const UNKNOWN_COLLECTION = 'unknown-collection';

const anon = () => testEnv.unauthenticatedContext().firestore();
const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();

/** Seed data with rules disabled (simulates Admin-SDK trusted writes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seed(mutate: (db: any) => Promise<void>): Promise<void> {
	await testEnv.withSecurityRulesDisabled(async (ctx) => mutate(ctx.firestore()));
}

async function seedVotableReferendum(index = 1): Promise<void> {
	await seed(async (db) => {
		await db.collection('referenda').doc(String(index)).set({ index, title: 'Ref', status: 'Deciding' });
		await db.collection('referenda').doc(String(index)).collection('stats').doc('current').set({ ayePoints: 0, totalVoters: 0 });
		await db.collection('referenda').doc(String(index)).collection('votes').doc('voter-1').set({ decision: 'aye', pointsUsed: 10 });
	});
}

async function seedDemoPost(postId = 'post-1'): Promise<void> {
	await seed(async (db) => {
		await db.collection('posts').doc(postId).set({ title: 'T', content: 'C', authorUid: 'author-1', status: 'active', isPinned: false });
		await db.collection('posts').doc(postId).collection('comments').doc('c1').set({ content: 'hello', authorUid: 'author-1' });
		await db
			.collection('posts')
			.doc(postId)
			.collection('votes')
			.doc('voter-1')
			.set({ selectedOptions: [0] });
		await db.collection('posts').doc(postId).collection('stats').doc('votes').set({ totalVoters: 1 });
	});
}

async function seedUser(uid: string): Promise<void> {
	await seed(async (db) => {
		await db
			.collection('users')
			.doc(uid)
			.set({ uid, email: `${uid}@example.com`, displayName: 'User', role: 'user', pointsBalance: 1000 });
	});
}
// ===== Referenda: public read, zero client writes =====
describe('referenda/{index}', () => {
	it('allows anonymous and authenticated reads', async () => {
		await seedVotableReferendum();
		await assertSucceeds(getDoc(doc(anon(), 'referenda', '1')));
		await assertSucceeds(getDoc(doc(asUser('u1'), 'referenda', '1')));
		await assertSucceeds(getDocs(collection(anon(), 'referenda')));
	});

	it('denies client creation of referenda (trusted creation API only)', async () => {
		await Promise.all([assertFails(setDoc(doc(anon(), 'referenda', '9'), { title: 'x' })), assertFails(setDoc(doc(asUser('u1'), 'referenda', '9'), { title: 'x' }))]);
	});

	it('denies client lifecycle mutation, including by so-called admin tokens', async () => {
		await seedVotableReferendum();
		await Promise.all([
			assertFails(updateDoc(doc(asUser('u1'), 'referenda', '1'), { status: 'Confirmed' })),
			assertFails(updateDoc(doc(asUser('admin-1'), 'referenda', '1'), { status: 'Confirmed' })),
			assertFails(deleteDoc(doc(asUser('u1'), 'referenda', '1')))
		]);
	});
});

// ===== Referenda votes: owner-only read, zero client writes =====
describe('referenda/{index}/votes/{uid}', () => {
	it('allows the owner to read their own vote', async () => {
		await seedVotableReferendum();
		await assertSucceeds(getDoc(doc(asUser('voter-1'), 'referenda', '1', 'votes', 'voter-1')));
	});

	it('denies other users, anonymous users and listing the votes collection', async () => {
		await seedVotableReferendum();
		await assertFails(getDoc(doc(asUser('voter-2'), 'referenda', '1', 'votes', 'voter-1')));
		await assertFails(getDoc(doc(anon(), 'referenda', '1', 'votes', 'voter-1')));
		// Collection query cannot be constrained to the caller's own UID.
		await assertFails(getDocs(collection(asUser('voter-1'), 'referenda', '1', 'votes')));
		await assertFails(getDocs(collection(anon(), 'referenda', '1', 'votes')));
	});

	it('denies direct vote writes (voting goes through the trusted API)', async () => {
		await seedVotableReferendum();
		const me = doc(asUser('voter-1'), 'referenda', '1', 'votes', 'voter-1');
		await Promise.all([
			assertFails(setDoc(me, { decision: 'aye', pointsUsed: 999999 })),
			assertFails(setDoc(me, { decision: 'aye', pointsUsed: HUGE })),
			assertFails(updateDoc(me, { decision: 'nay' })),
			assertFails(deleteDoc(me))
		]);
	});
});

// ===== Referenda stats: public read, zero client writes =====
describe('referenda/{index}/stats/current', () => {
	it('allows anonymous reads of aggregate results', async () => {
		await seedVotableReferendum();
		await assertSucceeds(getDoc(doc(anon(), 'referenda', '1', 'stats', 'current')));
	});

	it('denies client stats mutation', async () => {
		await seedVotableReferendum();
		const ref = doc(asUser('u1'), 'referenda', '1', 'stats', 'current');
		await Promise.all([assertFails(setDoc(ref, { ayePoints: 999999 })), assertFails(updateDoc(ref, { ayePoints: 1 }))]);
	});
});

// ===== Counters: fully inaccessible =====
describe('counters/{name}', () => {
	it('denies all client reads and writes, anonymous or authenticated', async () => {
		await seed(async (db) => db.collection('counters').doc('referenda').set({ value: 5 }));
		const ref = doc(asUser('u1'), 'counters', 'referenda');
		await Promise.all([
			assertFails(getDoc(ref)),
			assertFails(getDocs(collection(anon(), 'counters'))),
			assertFails(setDoc(ref, { value: 100 })),
			assertFails(setDoc(doc(anon(), 'counters', 'referenda'), { value: 0 }))
		]);
	});
});
// ===== Users: owner-only read (email PII + role + pointsBalance), zero client writes =====
describe('users/{uid}', () => {
	it('allows only the owner to read their own profile document', async () => {
		await seedUser('u1');
		await assertSucceeds(getDoc(doc(asUser('u1'), 'users', 'u1')));
		await assertFails(getDoc(doc(asUser('u2'), 'users', 'u1')));
		await assertFails(getDoc(doc(anon(), 'users', 'u1')));
	});

	it('denies listing the users collection (PII harvesting / enumeration)', async () => {
		await seedUser('u1');
		await seedUser('u2');
		await Promise.all([
			assertFails(getDocs(collection(asUser('u1'), 'users'))),
			assertFails(getDocs(collection(anon(), 'users'))),
			assertFails(getDocs(query(collection(asUser('u1'), 'users'), where('role', '==', 'admin'))))
		]);
	});

	it('denies role escalation and pointsBalance self-modification', async () => {
		await seedUser('u1');
		const self = doc(asUser('u1'), 'users', 'u1');
		await Promise.all([
			assertFails(updateDoc(self, { role: 'admin' })),
			assertFails(updateDoc(self, { pointsBalance: 999999 })),
			assertFails(setDoc(self, { role: 'admin', pointsBalance: 999999 }, { merge: true })),
			assertFails(deleteDoc(self))
		]);
	});
});

// ===== DemoOS posts/comments: public read, zero client writes =====
describe('posts/{postId} (client-write lockdown)', () => {
	it('allows public reads of posts, comments, poll votes and stats', async () => {
		await seedDemoPost();
		const db = anon();
		await assertSucceeds(getDoc(doc(db, 'posts', 'post-1')));
		await assertSucceeds(getDoc(doc(db, 'posts', 'post-1', 'comments', 'c1')));
		await assertSucceeds(getDocs(collection(db, 'posts', 'post-1', 'comments')));
		await assertSucceeds(getDoc(doc(asUser('voter-1'), 'posts', 'post-1', 'votes', 'voter-1')));
		await assertSucceeds(getDoc(doc(db, 'posts', 'post-1', 'stats', 'votes')));
	});

	it('denies client post creation (trusted DemoPostService API only)', async () => {
		await Promise.all([
			assertFails(setDoc(doc(anon(), 'posts', 'new'), { title: 'x', content: 'y' })),
			assertFails(setDoc(doc(asUser('u1'), 'posts', 'new'), { title: 'x', content: 'y' }))
		]);
	});

	it('denies ownership-hijack and moderation-field escalation on update', async () => {
		await seedDemoPost();
		const owner = doc(asUser('author-1'), 'posts', 'post-1');
		const other = doc(asUser('u1'), 'posts', 'post-1');
		await Promise.all([
			// Even the original author may not mutate protected fields client-side.
			assertFails(updateDoc(owner, { status: 'locked' })),
			assertFails(updateDoc(owner, { isPinned: true })),
			assertFails(updateDoc(owner, { authorUid: 'u1' })),
			assertFails(updateDoc(owner, { commentCount: 999999 })),
			assertFails(updateDoc(owner, { title: 'hacked' })),
			assertFails(updateDoc(other, { title: 'hacked' })),
			assertFails(deleteDoc(owner))
		]);
	});

	it('denies 1 MB schema-pollution writes on posts and comments', async () => {
		await seedDemoPost();
		await Promise.all([
			assertFails(setDoc(doc(asUser('u1'), 'posts', 'polluted'), { title: HUGE, content: HUGE })),
			assertFails(setDoc(doc(asUser('u1'), 'posts', 'post-1', 'comments', 'polluted'), { content: HUGE }))
		]);
	});

	it('denies client comment creation/update/deletion, even with a matching authorUid', async () => {
		await seedDemoPost();
		const mine = doc(asUser('author-1'), 'posts', 'post-1', 'comments', 'c1');
		await Promise.all([
			assertFails(setDoc(doc(asUser('u1'), 'posts', 'post-1', 'comments', 'new'), { content: 'x', authorUid: 'u1' })),
			assertFails(updateDoc(mine, { content: 'edited' })),
			// Attacker forges someone else's authorUid into the request payload.
			assertFails(setDoc(doc(asUser('u1'), 'posts', 'post-1', 'comments', 'spoof'), { content: 'x', authorUid: 'author-1' })),
			assertFails(deleteDoc(mine))
		]);
	});

	it('denies discussion-poll vote writes and other users poll-vote reads', async () => {
		await seedDemoPost();
		const db = asUser('voter-1');
		await Promise.all([
			assertFails(getDoc(doc(asUser('voter-2'), 'posts', 'post-1', 'votes', 'voter-1'))),
			assertFails(getDocs(collection(anon(), 'posts', 'post-1', 'votes'))),
			assertFails(setDoc(doc(db, 'posts', 'post-1', 'votes', 'voter-1'), { selectedOptions: [0] })),
			assertFails(setDoc(doc(db, 'posts', 'post-1', 'stats', 'votes'), { totalVoters: 999 }))
		]);
	});
});

// ===== Catch-all deny =====
describe('catch-all deny', () => {
	it('denies unknown collections and arbitrary paths for every caller', async () => {
		await Promise.all([
			assertFails(getDoc(doc(anon(), UNKNOWN_COLLECTION, 'x'))),
			assertFails(getDoc(doc(asUser('u1'), UNKNOWN_COLLECTION, 'x'))),
			assertFails(setDoc(doc(asUser('u1'), UNKNOWN_COLLECTION, 'x'), { a: 1 }))
		]);
	});
});
