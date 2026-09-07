// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable import/no-extraneous-dependencies, import/no-default-export */

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.{ts,js}'],
		exclude: ['node_modules/**', 'functions/**'],
		testTimeout: 120000,
		hookTimeout: 60000
	}
});
