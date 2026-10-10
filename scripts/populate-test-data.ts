#!/usr/bin/env tsx
// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Test data population script for manual testing with Firebase emulator.
 *
 * This script creates:
 * - 25 test users with varying points balances
 * - A test referendum (or uses an existing one)
 * - 25 votes from different users with varying decisions and points
 * - 25 comments from different users
 *
 * Usage:
 *   1. Start the Firebase emulator: `firebase emulators:start --only firestore,auth`
 *   2. Run this script: `npx tsx scripts/populate-test-data.ts`
 *
 * The script connects to the Firestore emulator at 127.0.0.1:8080
 * and Auth emulator at 127.0.0.1:9099.
 */

/* eslint-disable no-await-in-loop, no-restricted-syntax, no-console */

// Must be set BEFORE importing firebase-admin modules
import { Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-test-data';
process.env.NODE_ENV = 'development';

const PROJECT_ID = 'demo-test-data';
const NUM_USERS = 25;
const NUM_COMMENTS = 25;

interface TestUser {
	uid: string;
	email: string;
	displayName: string;
	pointsBalance: number;
}

// Initialize admin SDK for emulator
if (!admin.apps.length) {
	admin.initializeApp({
		projectId: PROJECT_ID
	});
}

async function main() {
	console.log('🚀 Starting test data population...\n');

	const auth = admin.auth();
	const db = admin.firestore();

	const { ReferendumTrustedService } = await import('@/app/api/_api-services/referenda/referendumTrustedService');
	const trustedService = new ReferendumTrustedService();

	// Step 1: Create test users
	console.log(`📝 Creating ${NUM_USERS} test users...`);
	const users: TestUser[] = [];

	for (let i = 1; i <= NUM_USERS; i += 1) {
		const uid = `test-user-${i}`;
		const email = `test${i}@example.com`;
		const displayName = `Test User ${i}`;
		const pointsBalance = 500 + i * 40;

		try {
			await auth.createUser({ uid, email, displayName });
		} catch (err) {
			const { code } = err as { code?: string };
			if (code !== 'auth/uid-already-exists' && code !== 'auth/uid-exists') throw err;
		}

		await db
			.collection('users')
			.doc(uid)
			.set({
				uid,
				email,
				displayName,
				role: i === 1 ? 'admin' : 'user',
				pointsBalance,
				createdAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
				schemaVersion: 1
			});

		users.push({ uid, email, displayName, pointsBalance });
		console.log(`  ✓ Created ${displayName} (${pointsBalance} points${i === 1 ? ', admin' : ''})`);

		// Small delay to avoid transaction lock timeouts in emulator
		await new Promise((resolve) => {
			setTimeout(resolve, 50);
		});
	}

	// Step 2: Create a test referendum
	console.log('\n📝 Creating test referendum...');
	const now = Date.now();
	const HOUR = 60 * 60 * 1000;

	const referendumInput = {
		title: 'Test Referendum for Manual Testing',
		content: `# Test Referendum

This referendum was created by the test data population script for manual testing purposes.

## Voting Instructions
- 25 test users have been created with varying points balances
- Each user will cast a vote with different decisions and points
- 25 comments will be added from different users

## Test Data Summary
- **Total Users**: ${NUM_USERS}
- **Total Votes**: ${NUM_USERS} (one per user)
- **Total Comments**: ${NUM_COMMENTS}

Use this referendum to test:
- Vote display and aggregation
- Comment pagination
- Real-time stats updates
- Discussion lock functionality`,
		origin: 'root' as const,
		tags: ['test', 'manual-testing', 'demo'],
		votingStartsAt: new Date(now - HOUR).toISOString(),
		votingEndsAt: new Date(now + 24 * HOUR).toISOString(),
		approvalThresholdBps: 5000,
		minimumTurnoutPoints: 100
	};

	const actor = { uid: users[0].uid, displayName: users[0].displayName };
	const created = await trustedService.createReferendum(actor, referendumInput);
	const referendumIndex = created.index;

	console.log(`  ✓ Created referendum #${referendumIndex}`);

	// Step 3: Cast votes from all users
	console.log(`\n📝 Casting ${NUM_USERS} votes...`);
	const decisions = ['aye', 'nay', 'abstain'] as const;

	for (let i = 0; i < users.length; i += 1) {
		// eslint-disable-next-line security/detect-object-injection
		const user = users[i];
		const decision = decisions[i % 3];
		const pointsUsed = Math.min(50 + i * 10, user.pointsBalance);

		const voteActor = { uid: user.uid, displayName: user.displayName };
		await trustedService.upsertVote(referendumIndex, voteActor, { decision, pointsUsed });

		console.log(`  ✓ ${user.displayName} voted ${decision} with ${pointsUsed} points`);

		// Small delay to avoid transaction lock timeouts in emulator
		await new Promise((resolve) => {
			setTimeout(resolve, 100);
		});
	}

	// Step 4: Add comments from all users
	console.log(`\n📝 Adding ${NUM_COMMENTS} comments...`);

	const commentTemplates = [
		'Great proposal! I fully support this initiative.',
		'I have some concerns about the implementation details.',
		'This is exactly what we needed. Thank you for proposing this.',
		'Could you provide more context on the expected outcomes?',
		'I disagree with the approach but respect the discussion.',
		'Excellent analysis in the proposal document.',
		'What are the potential risks associated with this?',
		'The community will benefit greatly from this change.',
		'I suggest we consider alternative approaches as well.',
		'This aligns well with our long-term goals.',
		'Have we considered the impact on existing users?',
		'The timeline seems ambitious but achievable.',
		'I appreciate the thorough research behind this proposal.',
		'What metrics will we use to measure success?',
		'This needs more discussion before we can proceed.',
		"Strong +1 from me. Let's make this happen!",
		"I'm on the fence. Convince me otherwise.",
		'The technical feasibility is questionable.',
		'This is a step in the right direction.',
		'We should prioritize this over other proposals.',
		"Interesting perspective. I hadn't considered that angle.",
		'The cost-benefit analysis seems favorable.',
		"I'd like to see a pilot program first.",
		'This addresses a real pain point in the community.',
		'Looking forward to seeing this implemented!'
	];

	for (let i = 0; i < NUM_COMMENTS; i += 1) {
		// eslint-disable-next-line security/detect-object-injection
		const user = users[i % users.length];
		// eslint-disable-next-line security/detect-object-injection
		const content = commentTemplates[i % commentTemplates.length];

		const commentActor = { uid: user.uid, displayName: user.displayName };
		await trustedService.addComment(referendumIndex, commentActor, content);

		console.log(`  ✓ ${user.displayName} commented: "${content.substring(0, 50)}..."`);

		// Small delay to avoid transaction lock timeouts in emulator
		await new Promise((resolve) => {
			setTimeout(resolve, 100);
		});
	}

	// Summary
	console.log('\n✅ Test data population complete!');
	console.log('\n📊 Summary:');
	console.log(`  - Users: ${NUM_USERS} (first user is admin)`);
	console.log(`  - Referendum: #${referendumIndex}`);
	console.log(`  - Votes: ${NUM_USERS}`);
	console.log(`  - Comments: ${NUM_COMMENTS}`);
	console.log(`\n🌐 Open http://localhost:3000/referenda/${referendumIndex} to view the referendum`);
	console.log('\n🔐 Admin login: test1@example.com (password not set - use emulator UI)');
	console.log(`📝 Test users: test1@example.com through test${NUM_USERS}@example.com`);
}

main().catch((err) => {
	console.error('❌ Error:', err);
	process.exit(1);
});
