// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextResponse } from 'next/server';
import { StatusCodes } from 'http-status-codes';
import { ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';
import { VoteValidationError, CreationValidationError } from '@/domain/services/referendumValidation';

/**
 * Error mapping for the points-based Referenda API family.
 * Maps all domain errors (ReferendaServiceError, VoteValidationError,
 * CreationValidationError) to the correct HTTP status codes.
 */
export function referendaErrorResponse(err: unknown): NextResponse {
	let status = StatusCodes.INTERNAL_SERVER_ERROR;
	let message = 'Internal server error.';

	if (err instanceof ReferendaServiceError) {
		const statusByCode: Record<string, number> = {
			unauthorized: StatusCodes.UNAUTHORIZED,
			'not-found': StatusCodes.NOT_FOUND,
			'not-deciding': StatusCodes.CONFLICT,
			'outside-voting-window': StatusCodes.CONFLICT,
			'invalid-argument': StatusCodes.BAD_REQUEST,
			'insufficient-balance': StatusCodes.FORBIDDEN,
			conflict: StatusCodes.CONFLICT,
			forbidden: StatusCodes.FORBIDDEN
		};
		status = statusByCode[err.code] ?? StatusCodes.INTERNAL_SERVER_ERROR;
		message = err.message;
	} else if (err instanceof VoteValidationError) {
		status = StatusCodes.BAD_REQUEST;
		switch (err.code) {
			case 'not-logged-in':
				status = StatusCodes.UNAUTHORIZED;
				break;
			case 'referendum-not-found':
				status = StatusCodes.NOT_FOUND;
				break;
			case 'not-deciding':
			case 'outside-voting-window':
				status = StatusCodes.CONFLICT;
				break;
			case 'insufficient-balance':
				status = StatusCodes.FORBIDDEN;
				break;
			default:
				status = StatusCodes.BAD_REQUEST;
				break;
		}
		message = err.message;
	} else if (err instanceof CreationValidationError) {
		status = err.code === 'unauthorized' ? StatusCodes.UNAUTHORIZED : StatusCodes.BAD_REQUEST;
		message = err.message;
	} else {
		// eslint-disable-next-line no-console
		console.error('Referenda API unhandled error:', err);
	}

	return NextResponse.json({ message }, { status });
}

// ─── Cache-Control helpers (F13) ─────────────────────────────────────────────
// Prevent shared caches (CDN, proxy) from serving user-specific data to other
// users. Applied to every JSON response from the referenda API family.

/** Private, no-store — for auth-required routes (votes/me, capabilities, admin). */
export function privateCache(response: NextResponse): NextResponse {
	response.headers.set('Cache-Control', 'private, no-store, must-revalidate');
	response.headers.set('Vary', 'Authorization');
	return response;
}

/** Short public cache — for anonymous-safe routes (list, detail, stats, public votes). */
export function publicCache(response: NextResponse, maxAgeSeconds = 10): NextResponse {
	response.headers.set('Cache-Control', `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=30`);
	return response;
}
