// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable import/no-extraneous-dependencies, import/no-default-export */

import { defineConfig } from 'vitest/config';

/**
 * React component interaction tests with jsdom environment.
 * Tests live alongside components in `src/**/__tests__/*.component.test.{ts,tsx}`
 * or in `src/**/*.test.{ts,tsx}` with a `@vitest-environment jsdom` docblock.
 */
export default defineConfig({
	test: {
		include: ['src/**/*.component.test.{ts,tsx}'],
		exclude: ['node_modules/**', 'functions/**', 'tests/**'],
		environment: 'jsdom',
		testTimeout: 30000,
		hookTimeout: 15000
	}
});
