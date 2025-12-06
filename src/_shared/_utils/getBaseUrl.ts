// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use server';

import { headers } from 'next/headers';

export async function getBaseUrl(): Promise<string> {
	if (global?.window) return `${global.window.location.origin}/api/v2`;

	const headersList = await headers();
	const domain = headersList.get('host') || '';

	// Force http for localhost/127.0.0.1, even if x-forwarded-proto says https
	const isLocalhost = domain.includes('localhost') || domain.startsWith('127.0.0.1');
	const forwardedProto = headersList.get('x-forwarded-proto');
	const protocol = isLocalhost ? 'http' : forwardedProto || 'https';

	const baseUrl = `${protocol}://${domain}/api/v2`;
	console.log('🔍 getBaseUrl:', { domain, protocol, baseUrl, forwardedProto, isLocalhost });

	return baseUrl;
}
