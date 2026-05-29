// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v2/upload
 *
 * Backend image upload handler that forwards image files to imgbb API.
 * This prevents exposing the imgbb API key on the client side.
 *
 * Request body: FormData with 'image' field containing the image file
 * Response: JSON response from imgbb API
 */
export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File | null;

		// Validate that a file was provided
		if (!file) {
			console.error('[Upload API Error] No image file provided');
			return NextResponse.json(
				{
					success: false,
					error: 'No image file provided'
				},
				{ status: 400 }
			);
		}

		// Get imgbb API key from environment variables
		const imgbbApiKey = process.env.IMGBB_API_KEY;
		if (!imgbbApiKey) {
			console.error('[Upload API Error] IMGBB_API_KEY is not configured in environment variables');
			return NextResponse.json(
				{
					success: false,
					error: 'Server configuration error: IMGBB_API_KEY is not configured'
				},
				{ status: 500 }
			);
		}

		// Prepare FormData for imgbb API
		const imgbbFormData = new FormData();
		imgbbFormData.append('image', file);
		imgbbFormData.append('key', imgbbApiKey);

		// Forward request to imgbb API
		const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
			method: 'POST',
			body: imgbbFormData
		});

		// Get imgbb response data
		const imgbbData = await imgbbResponse.json();

		// Log imgbb response for debugging
		if (!imgbbResponse.ok || !imgbbData?.success) {
			console.error('[Upload API Error] imgbb API error:', {
				status: imgbbResponse.status,
				statusText: imgbbResponse.statusText,
				response: imgbbData
			});
		}

		// Always return the imgbb response as-is to frontend
		// Frontend will handle success/failure checking
		return NextResponse.json(imgbbData, {
			status: imgbbResponse.ok ? 200 : imgbbResponse.status
		});
	} catch (error) {
		console.error('[Upload API Error] Unexpected error during upload:', error);
		const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during upload';
		return NextResponse.json(
			{
				success: false,
				error: errorMessage
			},
			{ status: 500 }
		);
	}
}
