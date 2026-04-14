// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

/**
 * castVote — Firebase callable function for the DemoOS voting system.
 *
 * Validates:
 *  - User is authenticated
 *  - User pointsBalance >= 1 (gate only — no deduction)
 *  - User has NOT already voted on this post
 *  - All selectedOptions are valid indices into poll.options
 *
 * Atomically writes `posts/{postId}/votes/{uid}` and updates
 * `posts/{postId}/stats/votes` inside a Firestore transaction.
 */
export const castVote = onCall(
	{
		maxInstances: 10,
		timeoutSeconds: 60
	},
	async (request) => {
		// 1. Authentication check
		if (!request.auth?.uid) {
			throw new HttpsError('unauthenticated', 'You must be logged in to vote.');
		}

		const uid = request.auth.uid;
		const { postId, selectedOptions } = request.data as { postId?: string; selectedOptions?: unknown };

		// 2. Input validation
		if (!postId || typeof postId !== 'string') {
			throw new HttpsError('invalid-argument', 'postId is required.');
		}
		if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
			throw new HttpsError('invalid-argument', 'selectedOptions must be a non-empty array.');
		}
		const options = selectedOptions as number[];
		if (options.some((o) => typeof o !== 'number' || !Number.isInteger(o) || o < 0)) {
			throw new HttpsError('invalid-argument', 'selectedOptions must contain non-negative integers.');
		}

		const db = getFirestore();

		try {
			await db.runTransaction(async (tx) => {
				// 3–6. Perform ALL reads before any writes (Firestore requirement)
				const postRef = db.collection('posts').doc(postId);
				const voteRef = postRef.collection('votes').doc(uid);
				const userRef = db.collection('users').doc(uid);
				const statsRef = postRef.collection('stats').doc('votes');

				const [postDoc, voteDoc, userDoc, statsDoc] = await Promise.all([tx.get(postRef), tx.get(voteRef), tx.get(userRef), tx.get(statsRef)]);

				// 3. Validate post and poll
				if (!postDoc.exists) {
					throw new HttpsError('not-found', 'Post not found.');
				}

				const postData = postDoc.data()!;
				const poll = postData.poll as { question: string; options: string[] } | undefined;

				if (!poll || !Array.isArray(poll.options) || poll.options.length === 0) {
					throw new HttpsError('failed-precondition', 'This post does not have a poll.');
				}

				// 4. Validate option indices
				const maxIndex = poll.options.length - 1;
				if (options.some((o) => o > maxIndex)) {
					throw new HttpsError('invalid-argument', `selectedOptions contains an index out of range (max: ${maxIndex}).`);
				}

				// 5. Check if the user has already voted
				if (voteDoc.exists) {
					throw new HttpsError('already-exists', 'You have already voted on this post.');
				}

				// 6. Check pointsBalance >= 1
				const pointsBalance = (userDoc.data()?.pointsBalance as number) ?? 0;
				if (pointsBalance < 1) {
					throw new HttpsError('permission-denied', 'You need at least 1 point to vote.');
				}

				// 7. Write the vote document (all writes come after all reads)
				const now = Timestamp.now();
				tx.set(voteRef, {
					uid,
					selectedOptions: options,
					votedAt: now
				});

				// 8. Update aggregated stats

				if (!statsDoc.exists) {
					// Initialise stats document
					const optionCounts = new Array(poll.options.length).fill(0) as number[];
					options.forEach((idx) => {
						optionCounts[idx] = 1;
					});
					tx.set(statsRef, {
						totalVoters: 1,
						optionCounts,
						lastUpdated: now
					});
				} else {
					// Read-modify-write the optionCounts array atomically within the transaction
					const existingCounts: number[] = Array.isArray(statsDoc.data()?.optionCounts)
						? ([...(statsDoc.data()!.optionCounts as number[])] as number[])
						: (new Array(poll.options.length).fill(0) as number[]);

					options.forEach((idx) => {
						existingCounts[idx] = (existingCounts[idx] ?? 0) + 1;
					});

					tx.update(statsRef, {
						totalVoters: FieldValue.increment(1),
						optionCounts: existingCounts,
						lastUpdated: now
					});
				}
			});

			logger.info(`castVote: user ${uid} voted on post ${postId} with options [${options.join(',')}]`);
			return { success: true };
		} catch (err) {
			if (err instanceof HttpsError) throw err;
			logger.error('castVote transaction error:', err);
			throw new HttpsError('internal', 'An error occurred while casting your vote. Please try again.');
		}
	}
);
