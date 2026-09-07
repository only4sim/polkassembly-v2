// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertSucceeds, assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { setLogLevel } from 'firebase/firestore';

setLogLevel('silent');

const PROJECT_ID = 'cbs-assembly';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
	const rulesContent = readFileSync('firestore.rules', 'utf8');
	testEnv = await initializeTestEnvironment({
		projectId: PROJECT_ID,
		firestore: {
			rules: rulesContent,
			host: '127.0.0.1',
			port: 8080
		}
	});
});

afterAll(async () => {
	await testEnv?.cleanup();
});

beforeEach(async () => {
	await testEnv?.clearFirestore();
});

// Referenda collection
describe('referenda collection', () => {
	it('allows anonymous read', async () => {
		const anonDb = testEnv.unauthenticatedContext().firestore();
		await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
			await ctx.firestore().collection('referenda').doc('1').set({ title: 'test' });
		});
		await assertSucceeds(anonDb.collection('referenda').doc('1').get());
	});

	it('allows authenticated read', async () => {
		const db = testEnv.authenticatedContext('u1').firestore();
		await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
			await ctx.firestore().collection('referenda').doc('1').set({ title: 't' });
		});
		await assertSucceeds(db.collection('referenda').doc('1').get());
	});

	it('denies anonymous create', async () => {
		await assertFails(testEnv.unauthenticatedContext().firestore().collection('referenda').doc('1').set({ title: 't' }));
	});

	it('denies authenticated update of lifecycle', async () => {
		const db = testEnv.authenticatedContext('u1').firestore();
		await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
			await ctx.firestore().collection('referenda').doc('1').set({ title: 't', status: 'Deciding' });
		});
		await assertFails(db.collection('referenda').doc('1').update({ status: 'Confirmed' }));
	});
});

// Votes
describe('votes subcollection', () => {
	it('allows own-vote read', async () => {
		await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
			await ctx.firestore().collection('referenda').doc('1').collection('votes').doc('v1').set({ uid: 'v1' });
		});
		await assertSucceeds(testEnv.authenticatedContext('v1').firestore().collection('referenda').doc('1').collection('votes').doc('v1').get());
	});

	it('denies reading other users vote', async () => {
		await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
			await ctx.firestore().collection('referenda').doc('1').collection('votes').doc('v2').set({ uid: 'v2' });
		});
		await assertFails(testEnv.authenticatedContext('v1').firestore().collection('referenda').doc('1').collection('votes').doc('v2').get());
	});

	it('denies client-side vote write', async () => {
		await assertFails(testEnv.authenticatedContext('u1').firestore().collection('referenda').doc('1').collection('votes').doc('u1').set({ uid: 'u1', decision: 'aye' }));
	});
});

// Stats
describe('stats subcollection', () => {
	it('allows anonymous stat read', async () => {
		await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
			await ctx.firestore().collection('referenda').doc('1').collection('stats').doc('current').set({ ayePoints: 100 });
		});
		await assertSucceeds(testEnv.unauthenticatedContext().firestore().collection('referenda').doc('1').collection('stats').doc('current').get());
	});

	it('denies client-side stats write', async () => {
		await assertFails(testEnv.authenticatedContext('u1').firestore().collection('referenda').doc('1').collection('stats').doc('current').set({ ayePoints: 100 }));
	});
});

// Users
describe('users collection', () => {
	it('allows authenticated user read', async () => {
		await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
			await ctx.firestore().collection('users').doc('u1').set({ uid: 'u1' });
		});
		await assertSucceeds(testEnv.authenticatedContext('u1').firestore().collection('users').doc('u1').get());
	});

	it('denies client-side user update', async () => {
		await assertFails(testEnv.authenticatedContext('u1').firestore().collection('users').doc('u1').set({ displayName: 'Hacked' }));
	});

	it('denies anonymous user write', async () => {
		await assertFails(testEnv.unauthenticatedContext().firestore().collection('users').doc('u1').set({ displayName: 'Hacked' }));
	});
});

// Catch-all
describe('catch-all rule', () => {
	it('denies unknown collection access', async () => {
		await assertFails(testEnv.authenticatedContext('u1').firestore().collection('secret').doc('x').get());
	});
});
