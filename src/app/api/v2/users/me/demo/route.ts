// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { FirestoreUserRepository } from '@/adapters/firestore/FirestoreUserRepository';
import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';

const userRepository = new FirestoreUserRepository();

async function getAuthedUid(req: NextRequest): Promise<string | null> {
	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) return null;
	const decoded = await DemoAuthService.verifyIdToken(idToken);
	return decoded?.uid ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
	const uid = await getAuthedUid(req);
	if (!uid) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const user = await userRepository.getUserByUid(uid);
	if (!user) {
		return NextResponse.json({ message: 'User not found' }, { status: StatusCodes.NOT_FOUND });
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
	const uid = await getAuthedUid(req);
	if (!uid) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
	}

	const body = await req.json().catch(() => ({}));
	const { displayName } = body as { displayName?: string };

	if (typeof displayName === 'string' && displayName.trim()) {
		await userRepository.updateUser(uid, { displayName: displayName.trim() });
	}

	return NextResponse.json({ success: true });
}
