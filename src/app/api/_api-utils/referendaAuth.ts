// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { ReferendaServiceError, type VerifiedActor } from '@/app/api/_api-services/referenda/referendumTrustedService';

/**
 * Derive the verified actor identity from the Authorization bearer token.
 *
 * Never trust uid/displayName/role/pointsBalance from the request body — identity
 * comes exclusively from the verified Firebase ID token.
 */
export async function requireVerifiedActor(req: NextRequest): Promise<VerifiedActor> {
	const authHeader = req.headers.get('Authorization');
	const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!idToken) {
		throw new ReferendaServiceError('unauthorized', 'You must be logged in.');
	}

	const decoded = await DemoAuthService.verifyIdToken(idToken);
	if (!decoded?.uid) {
		throw new ReferendaServiceError('unauthorized', 'Invalid or expired session.');
	}

	return {
		uid: decoded.uid,
		displayName: (decoded.name as string | undefined) || (decoded.email as string | undefined) || ''
	};
}

/** Resolve whether the actor is an administrator (authoritative server read). */
export async function isAdminActor(uid: string): Promise<boolean> {
	// Import lazily to avoid initialising firebase-admin before the auth check.
	const { getAdminDb } = await import('@/adapters/firestore/firestoreInit');
	const doc = await getAdminDb().collection('users').doc(uid).get();
	return (doc.data()?.role as string | undefined) === 'admin';
}

export { StatusCodes };
