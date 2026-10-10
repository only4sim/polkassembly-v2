#!/usr/bin/env tsx
// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Add bulk votes to an existing referendum for manual testing.
 *
 * Usage:
 *   npx tsx scripts/add-bulk-votes.ts <referendum-index> [num-votes]
 *
 * Example:
 *   npx tsx scripts/add-bulk-votes.ts 1 50
 *
 * This will add 50 votes from test users to referendum #1.
 * Requires test users to exist (run populate-test-data.ts first).
 */

/* eslint-disable no-await-in-loop, no-restricted-syntax, no-console */

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-test-data';

const PROJECT_ID = 'demo-test-data';

async function main() {
	const args = process.argv.slice(2);
	const referendumIndex = Number(args[0]);
	const numVotes = Number(args[1]) || 20;

	if (!referendumIndex || Number.isNaN(referendumIndex)) {
		console.error('Usage: npx tsx scripts/add-bulk-votes.ts <referendum-index> [num-votes]');
		process.exit(1);
	}

	console.log(`🚀 Adding ${numVotes} votes to referendum #${referendumIndex}...\n`);

	const { initializeApp } = await import('firebase-admin/app');
	const { getAuth } = await import('firebase-admin/auth');

	initializeApp({ projectId: PROJECT_ID });
	const auth = getAuth();

	const { getAdminDb } = await import('@/adapters/firestore/firestoreInit');
	const db = getAdminDb();

	const { ReferendumTrustedService } = await import('@/app/api/_api-services/referenda/referendumTrustedService');
	const { ReferendumDecision } = await import('@/domain/entities/Referendum');
	const trustedService = new ReferendumTrustedService();

	const decisions: Array<typeof ReferendumDecision.Aye | typeof ReferendumDecision.Nay | typeof ReferendumDecision.Abstain> = [
		ReferendumDecision.Aye,
		ReferendumDecision.Nay,
		ReferendumDecision.Abstain
	];

	for (let i = 1; i <= numVotes; i += 1) {
		const uid = `bulk-voter-${i}`;
		const email = `bulkvoter${i}@example.com`;
		const displayName = `Bulk Voter ${i}`;
		const pointsBalance = 1000;

		try {
			await auth.createUser({ uid, email, displayName });
		} catch (err) {
			if ((err as { code?: string }).code !== 'auth/uid-exists') throw err;
		}

		const userDoc = db.collection('users').doc(uid);
		const userSnap = await userDoc.get();

		if (!userSnap.exists) {
			const { Timestamp } = await import('firebase-admin/firestore');
			await userDoc.set({
				uid,
				email,
				displayName,
				role: 'user',
				pointsBalance,
				createdAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
				schemaVersion: 1
			});
		}

		const decision = decisions[i % 3];
		const pointsUsed = 50 + (i % 10) * 10;

		const actor = { uid, displayName };
		await trustedService.upsertVote(referendumIndex, actor, { decision, pointsUsed });

		console.log(`  ✓ ${displayName} voted ${decision} with ${pointsUsed} points`);
	}

	console.log(`\n✅ Added ${numVotes} votes to referendum #${referendumIndex}`);
}

main().catch((err) => {
	console.error('❌ Error:', err);
	process.exit(1);
});
