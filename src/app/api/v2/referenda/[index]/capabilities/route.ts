// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { ReferendumReadService } from '@/app/api/_api-services/referenda/referendumReadService';
import { ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { getAdminDb } from '@/adapters/firestore/firestoreInit';
import { deriveReferendumCapabilities } from '@/domain/services/referendumCapabilities';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';

const NOT_FOUND_MESSAGE = 'Referendum not found.';

/**
 * GET /api/v2/referenda/{index}/capabilities
 *
 * Trusted, server-derived capability view for the UI (plan PR-6). Auth is
 * optional — anonymous callers get the unauthenticated capability set. The
 * user document is read exactly once to derive BOTH the admin flag and the
 * authoritative pointsBalance, so the vote dialog never trusts client state.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ index: string }> }): Promise<NextResponse> {
	if (ENABLE_BLOCKCHAIN) {
		return referendaErrorResponse(new ReferendaServiceError('forbidden', 'Points capabilities are not available in chain mode.'));
	}
	const { index: raw } = await params;
	const index = /^\d+$/.test(raw) ? Number(raw) : null;
	if (index === null) {
		return referendaErrorResponse(new ReferendaServiceError('not-found', NOT_FOUND_MESSAGE));
	}

	try {
		const readService = new ReferendumReadService();
		const referendum = await readService.getByIndex(index);
		if (!referendum) {
			return NextResponse.json({ message: NOT_FOUND_MESSAGE }, { status: StatusCodes.NOT_FOUND });
		}

		// Soft auth: anonymous is a valid state for this endpoint.
		let uid: string | null = null;
		const authHeader = req.headers.get('Authorization');
		const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (idToken) {
			try {
				const decoded = await DemoAuthService.verifyIdToken(idToken);
				if (decoded?.uid) uid = decoded.uid;
			} catch {
				uid = null; // invalid/expired token → anonymous capabilities
			}
		}

		let isAdmin = false;
		let pointsBalance: number | undefined;
		if (uid) {
			const doc = await getAdminDb().collection('users').doc(uid).get();
			const userData = doc.data() ?? {};
			isAdmin = (userData.role as string | undefined) === 'admin';
			const balance = userData.pointsBalance;
			if (typeof balance === 'number' && Number.isSafeInteger(balance) && balance >= 0) {
				pointsBalance = balance;
			}
		}

		const capabilities = deriveReferendumCapabilities({
			status: referendum.status,
			now: new Date(),
			votingStartsAt: new Date(referendum.votingStartsAt),
			votingEndsAt: new Date(referendum.votingEndsAt),
			isAuthenticated: Boolean(uid),
			isAdmin
		});

		return NextResponse.json({ ...capabilities, pointsBalance: pointsBalance ?? null });
	} catch (err) {
		return referendaErrorResponse(err);
	}
}
