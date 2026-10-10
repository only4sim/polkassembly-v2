#!/usr/bin/env tsx
// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Add bulk comments to an existing referendum for manual testing.
 *
 * Usage:
 *   npx tsx scripts/add-bulk-comments.ts <referendum-index> [num-comments]
 *
 * Example:
 *   npx tsx scripts/add-bulk-comments.ts 1 50
 *
 * This will add 50 comments from test users to referendum #1.
 * Requires test users to exist (run populate-test-data.ts first).
 */

/* eslint-disable no-await-in-loop, no-restricted-syntax, no-console */

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-test-data';

const PROJECT_ID = 'demo-test-data';

const COMMENT_TEMPLATES = [
	'This is a great initiative! Fully supporting this.',
	'I have some concerns about the timeline.',
	'Excellent proposal. The community will benefit.',
	'Could you elaborate on the technical details?',
	'I disagree with the approach but respect the discussion.',
	'This addresses a critical need in our ecosystem.',
	'What are the potential risks we should consider?',
	"Strong support from my side. Let's move forward.",
	'The cost-benefit analysis looks favorable.',
	'I suggest we form a working group to refine this.',
	'Interesting perspective. Thanks for sharing.',
	'We need more data before making a decision.',
	'This aligns with our strategic goals.',
	'Have we considered the long-term implications?',
	'The implementation plan seems solid.',
	"I'm cautiously optimistic about this proposal.",
	'Great work on the research and documentation.',
	'What metrics will determine success?',
	'This could set an important precedent.',
	"I'd like to see a pilot program first.",
	'The community feedback has been mostly positive.',
	'We should prioritize this over other initiatives.',
	'Technically feasible but resource-intensive.',
	'This solves a real pain point for users.',
	'Looking forward to the discussion and debate.'
];

async function main() {
	const args = process.argv.slice(2);
	const referendumIndex = Number(args[0]);
	const numComments = Number(args[1]) || 20;

	if (!referendumIndex || Number.isNaN(referendumIndex)) {
		console.error('Usage: npx tsx scripts/add-bulk-comments.ts <referendum-index> [num-comments]');
		process.exit(1);
	}

	console.log(`🚀 Adding ${numComments} comments to referendum #${referendumIndex}...\n`);

	const { initializeApp } = await import('firebase-admin/app');
	const { getAuth } = await import('firebase-admin/auth');

	initializeApp({ projectId: PROJECT_ID });
	const auth = getAuth();

	const { getAdminDb } = await import('@/adapters/firestore/firestoreInit');
	const db = getAdminDb();

	const { ReferendumTrustedService } = await import('@/app/api/_api-services/referenda/referendumTrustedService');
	const trustedService = new ReferendumTrustedService();

	for (let i = 1; i <= numComments; i += 1) {
		const uid = `bulk-commenter-${i}`;
		const email = `bulkcommenter${i}@example.com`;
		const displayName = `Commenter ${i}`;
		const pointsBalance = 500;

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

		const content = COMMENT_TEMPLATES[i % COMMENT_TEMPLATES.length];
		const actor = { uid, displayName };
		await trustedService.addComment(referendumIndex, actor, content);

		console.log(`  ✓ ${displayName}: "${content.substring(0, 50)}..."`);
	}

	console.log(`\n✅ Added ${numComments} comments to referendum #${referendumIndex}`);
}

main().catch((err) => {
	console.error('❌ Error:', err);
	process.exit(1);
});
