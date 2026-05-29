// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use server';

import { headers } from 'next/headers';

export async function getBaseUrl(): Promise<string> {
	// 1. 如果在浏览器端运行，直接使用当前窗口域名
	if (typeof window !== 'undefined') return `${window.location.origin}/api/v2`;

	// 2. 优先读取我们手动锁定的环境变量（绝对安全，不会被代理层篡改）
	if (process.env.NEXT_PUBLIC_SITE_URL) {
		// 移除可能存在的末尾斜杠，保证拼接正确
		const baseUrl = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
		return `${baseUrl}/api/v2`;
	}

	// 3. 作为后备，从服务端请求头中智能提取
	try {
		const headersList = await headers();

		// 💡 核心修复：优先读取 x-forwarded-host，它通常保存了用户在浏览器里输入的原始域名
		const domain = headersList.get('x-forwarded-host') || headersList.get('host') || '';
		const protocol = headersList.get('x-forwarded-proto') || 'https';

		if (domain) {
			return `${protocol}://${domain}/api/v2`;
		}
	} catch {
		// 在 next build 静态打包期间调用 headers() 会报错，这里做个静默兜底
	}

	// 4. 本地环境/构建时的绝对兜底
	return 'http://localhost:3000/api/v2';
}
