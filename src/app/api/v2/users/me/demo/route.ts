// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { FirestoreUserRepository } from '@/adapters/firestore/FirestoreUserRepository';
import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import * as admin from 'firebase-admin';
import type firebaseAdminTypes from 'firebase-admin';

const userRepository = new FirestoreUserRepository();

async function getAuthedToken(req: NextRequest): Promise<firebaseAdminTypes.auth.DecodedIdToken | null> {
	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) return null;
	return DemoAuthService.verifyIdToken(idToken);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
	const decoded = await getAuthedToken(req);
	if (!decoded) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	let user = await userRepository.getUserByUid(decoded.uid);

	// Lazily create the Firestore user document on first profile access.
	// DemoAuthRegister only creates a Firebase Auth user; the Firestore document
	// is created here on the first authenticated GET request.
	if (!user) {
		try {
			// Fetch the latest user record from Firebase Auth so we get the correct
			// displayName even when the ID token was issued before updateProfile() ran
			// (which happens during registration when displayName is set after token issuance).
			const authUser = await admin
				.auth()
				.getUser(decoded.uid)
				.catch((err) => {
					console.warn('[demo/route] admin.auth().getUser() failed — falling back to token claims:', err);
					return null;
				});
			user = await userRepository.createUser({
				uid: decoded.uid,
				email: decoded.email ?? '',
				displayName: authUser?.displayName ?? decoded.name ?? decoded.email ?? '',
				role: 'user',
				pointsBalance: 0
			});
		} catch {
			return NextResponse.json({ message: 'Failed to initialise profile' }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
		}
	}

	return NextResponse.json({
		uid: user.uid,
		email: user.email,
		displayName: user.displayName,
		role: user.role,
		pointsBalance: user.pointsBalance,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt
	});
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
	const decoded = await getAuthedToken(req);
	if (!decoded) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const body = await req.json().catch(() => ({}));
	const { displayName } = body as { displayName?: string };

	if (typeof displayName === 'string' && displayName.trim()) {
		await userRepository.updateUser(decoded.uid, { displayName: displayName.trim() });
	}

	return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
	const decoded = await getAuthedToken(req);
	if (!decoded) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	try {
		await userRepository.deleteUser(decoded.uid);
	} catch {
		// If Firestore doc doesn't exist, that's fine — Firebase Auth user deletion proceeds
	}

	return NextResponse.json({ success: true });
}
