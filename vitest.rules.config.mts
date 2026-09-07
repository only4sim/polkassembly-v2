// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable import/no-extraneous-dependencies, import/no-default-export */

import { defineConfig } from 'vitest/config';

/**
 * Firestore security-rules tests. Requires the Firestore emulator on :8080
 * (`yarn test:rules`). Scoped to `tests/firestore/**` only — repository/service
 * integration tests live in `vitest.integration.config.mts`.
 */
export default defineConfig({
	test: {
		include: ['tests/firestore/**/*.test.{ts,js}'],
		exclude: ['node_modules/**', 'functions/**'],
		testTimeout: 120000,
		hookTimeout: 60000
	}
});
