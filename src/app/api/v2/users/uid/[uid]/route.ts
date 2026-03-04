// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { FirestoreUserRepository } from '@/adapters/firestore/FirestoreUserRepository';
import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';

const userRepository = new FirestoreUserRepository();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }): Promise<NextResponse> {
	const { uid } = await params;

	const user = await userRepository.getUserByUid(uid);
	if (!user) {
		return NextResponse.json({ message: 'User not found' }, { status: StatusCodes.NOT_FOUND });
	}

	// Public route — email is omitted for privacy
	return NextResponse.json({
		uid: user.uid,
		displayName: user.displayName,
		role: user.role,
		pointsBalance: user.pointsBalance,
		createdAt: user.createdAt
	});
}
