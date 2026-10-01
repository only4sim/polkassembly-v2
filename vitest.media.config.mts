// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable import/no-extraneous-dependencies, import/no-default-export */

import { defineConfig } from 'vitest/config';

/**
 * Media/Storage lifecycle tests. Requires Firestore + Storage emulators.
 * Tests upload validation, staged/published states, cleanup, and access rules.
 */
export default defineConfig({
	test: {
		include: ['tests/media/**/*.test.{ts,tsx}'],
		exclude: ['node_modules/**', 'functions/**'],
		testTimeout: 60000,
		hookTimeout: 30000
	}
});
