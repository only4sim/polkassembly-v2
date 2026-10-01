// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';
import { DemoAuthService } from '@/app/api/_api-services/demoAuthService';
import { referendaErrorResponse } from '@/app/api/_api-utils/referendaErrors';
import { ReferendaServiceError } from '@/app/api/_api-services/referenda/referendumTrustedService';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * POST /api/v2/upload
 *
 * F12 fix: authenticated image upload with type/size validation.
 * Forwards to imgbb API after verifying the caller and the file.
 */
export async function POST(request: NextRequest) {
	try {
		// F12 fix: require authentication before accepting uploads.
		const authHeader = request.headers.get('Authorization');
		const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!idToken) {
			return referendaErrorResponse(new ReferendaServiceError('unauthorized', 'Authentication required.'));
		}
		try {
			await DemoAuthService.verifyIdToken(idToken);
		} catch {
			return referendaErrorResponse(new ReferendaServiceError('unauthorized', 'Invalid or expired token.'));
		}

		const formData = await request.formData();
		const file = formData.get('image') as File | null;

		if (!file) {
			return NextResponse.json({ success: false, error: 'No image file provided' }, { status: 400 });
		}

		// F12 fix: validate file type — only allow known image MIME types.
		if (!ALLOWED_TYPES.includes(file.type)) {
			return NextResponse.json({ success: false, error: `Unsupported file type: ${file.type || 'unknown'}. Allowed: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
		}

		// F12 fix: enforce size limit.
		if (file.size > MAX_FILE_SIZE) {
			return NextResponse.json(
				{ success: false, error: `File too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum: ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
				{ status: 400 }
			);
		}

		const imgbbApiKey = process.env.IMGBB_API_KEY;
		if (!imgbbApiKey) {
			return NextResponse.json({ success: false, error: 'Server configuration error: IMGBB_API_KEY is not configured' }, { status: 500 });
		}

		const imgbbFormData = new FormData();
		imgbbFormData.append('image', file);
		imgbbFormData.append('key', imgbbApiKey);

		const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
			method: 'POST',
			body: imgbbFormData
		});

		const imgbbData = await imgbbResponse.json();

		if (!imgbbResponse.ok || !imgbbData?.success) {
			// eslint-disable-next-line no-console
			console.error('[Upload API Error] imgbb API error:', { status: imgbbResponse.status, statusText: imgbbResponse.statusText, response: imgbbData });
		}

		return NextResponse.json(imgbbData, {
			status: imgbbResponse.ok ? 200 : imgbbResponse.status
		});
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error('[Upload API Error] Unexpected error during upload:', error);
		const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during upload';
		return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
	}
}
