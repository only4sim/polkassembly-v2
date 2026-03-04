// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { FirestoreUserRepository } from '@/adapters/firestore/FirestoreUserRepository';
import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import type firebaseAdmin from 'firebase-admin';

const userRepository = new FirestoreUserRepository();

async function getAuthedToken(req: NextRequest): Promise<firebaseAdmin.auth.DecodedIdToken | null> {
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
			user = await userRepository.createUser({
				uid: decoded.uid,
				email: decoded.email ?? '',
				displayName: decoded.name ?? decoded.email ?? '',
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
