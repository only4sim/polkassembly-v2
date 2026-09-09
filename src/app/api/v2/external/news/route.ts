// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextResponse } from 'next/server';
import { GOOGLE_API_KEY, NEWS_GOOGLE_SHEET_ID, NEWS_GOOGLE_SHEET_NAME } from '@/app/api/_api-constants/apiEnvVars';
import { withErrorHandling } from '@/app/api/_api-utils/withErrorHandling';
import { GoogleSheetService } from '../../../_api-services/external_api_service/googlesheets_service';

/**
 * News items from the Google Sheet source.
 *
 * NON-CRITICAL cosmetic endpoint (NewsBanner marquee). In no-keys mode — or
 * whenever the upstream fetch fails for any reason — it degrades to an empty
 * list instead of an error response, so clients never log API_FETCH_ERROR.
 */
export const GET = withErrorHandling(async () => {
	// Guard: no Google API key configured (no-keys mode).
	if (!GOOGLE_API_KEY) {
		return NextResponse.json([]);
	}

	try {
		const newsItems = await GoogleSheetService.fetchSheetData(NEWS_GOOGLE_SHEET_ID, NEWS_GOOGLE_SHEET_NAME);
		return NextResponse.json(newsItems);
	} catch (error) {
		// Non-critical: degrade silently to an empty list.
		// eslint-disable-next-line no-console
		console.warn('[external/news] upstream fetch failed, returning empty list:', error instanceof Error ? error.message : error);
		return NextResponse.json([]);
	}
});
