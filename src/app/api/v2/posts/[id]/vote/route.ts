// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';

// Ensure the Admin SDK is initialised (mirrors demoPostService.ts pattern)
if (process.env.NODE_ENV === 'development') {
	process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099';
	process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
}

if (!admin.apps.length) {
	if (FIREBASE_SERVICE_ACC_CONFIG) {
		admin.initializeApp({
			credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACC_CONFIG))
		});
	} else {
		admin.initializeApp({
			projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cbs-assembly'
		});
	}
}

/**
 * POST /api/v2/posts/[id]/vote
 * Cast a vote on a post poll. Requires Firebase auth (Bearer token).
 *
 * Body: { selectedOptions: number[] }
 *
 * Validates:
 *  - User is authenticated
 *  - User pointsBalance >= 1 (gate only — no deduction)
 *  - User has NOT already voted on this post
 *  - All selectedOptions are valid indices into poll.options
 *
 * Returns: { success: true }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id: postId } = await params;

	// Auth
	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const decoded = await DemoAuthService.verifyIdToken(idToken);
	if (!decoded) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const uid = decoded.uid;

	// Parse body
	const body = (await req.json().catch(() => ({}))) as { selectedOptions?: unknown };
	const { selectedOptions } = body;

	if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
		return NextResponse.json({ message: 'selectedOptions must be a non-empty array' }, { status: StatusCodes.BAD_REQUEST });
	}

	const options = selectedOptions as number[];
	if (options.some((o) => typeof o !== 'number' || !Number.isInteger(o) || o < 0)) {
		return NextResponse.json({ message: 'selectedOptions must contain non-negative integers' }, { status: StatusCodes.BAD_REQUEST });
	}

	const db = admin.firestore();

	try {
		await db.runTransaction(async (tx) => {
			// --- All reads first (Firestore requirement) ---
			const postRef = db.collection('posts').doc(postId);
			const voteRef = postRef.collection('votes').doc(uid);
			const userRef = db.collection('users').doc(uid);
			const statsRef = postRef.collection('stats').doc('votes');

			const [postDoc, voteDoc, userDoc, statsDoc] = await Promise.all([tx.get(postRef), tx.get(voteRef), tx.get(userRef), tx.get(statsRef)]);

			// Validate post exists and has a poll
			if (!postDoc.exists) {
				throw Object.assign(new Error('Post not found'), { code: 'not-found' });
			}

			const postData = postDoc.data()!;
			const poll = postData.poll as { question: string; options: string[] } | undefined;

			if (!poll || !Array.isArray(poll.options) || poll.options.length === 0) {
				throw Object.assign(new Error('This post does not have a poll'), { code: 'no-poll' });
			}

			// Validate option indices
			const maxIndex = poll.options.length - 1;
			if (options.some((o) => o > maxIndex)) {
				throw Object.assign(new Error(`selectedOptions contains an index out of range (max: ${maxIndex})`), { code: 'invalid-option' });
			}

			// Check if user already voted
			if (voteDoc.exists) {
				throw Object.assign(new Error('You have already voted on this post'), { code: 'already-voted' });
			}

			// Check pointsBalance >= 1
			const pointsBalance = (userDoc.data()?.pointsBalance as number) ?? 0;
			if (pointsBalance < 1) {
				throw Object.assign(new Error('You need at least 1 point to vote'), { code: 'insufficient-points' });
			}

			// --- All writes after all reads ---
			const now = admin.firestore.Timestamp.now();

			// Write vote
			tx.set(voteRef, {
				uid,
				selectedOptions: options,
				votedAt: now
			});

			// Update aggregated stats
			if (!statsDoc.exists) {
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

		return NextResponse.json({ success: true });
	} catch (err) {
		const e = err as Error & { code?: string };
		if (e.code === 'not-found') {
			return NextResponse.json({ message: e.message }, { status: StatusCodes.NOT_FOUND });
		}
		if (e.code === 'no-poll' || e.code === 'invalid-option') {
			return NextResponse.json({ message: e.message }, { status: StatusCodes.BAD_REQUEST });
		}
		if (e.code === 'already-voted') {
			return NextResponse.json({ message: e.message }, { status: StatusCodes.CONFLICT });
		}
		if (e.code === 'insufficient-points') {
			return NextResponse.json({ message: e.message }, { status: StatusCodes.FORBIDDEN });
		}
		console.error(`[POST /api/v2/posts/${postId}/vote] Failed:`, err);
		return NextResponse.json({ message: 'Failed to cast vote' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
	}
}
