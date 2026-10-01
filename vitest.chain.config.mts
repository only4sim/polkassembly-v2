// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable import/no-extraneous-dependencies, import/no-default-export */

import { defineConfig } from 'vitest/config';

/**
 * Chain-mode regression tests. Verifies that the blockchain provider files,
 * feature flag entry points, and transaction services remain intact when
 * ENABLE_BLOCKCHAIN=true. No emulator required — pure unit/mock tests.
 */
export default defineConfig({
	test: {
		include: ['tests/chain/**/*.test.{ts,tsx}', 'src/**/__tests__/*chain*.test.{ts,tsx}'],
		exclude: ['node_modules/**', 'functions/**'],
		testTimeout: 30000
	}
});
