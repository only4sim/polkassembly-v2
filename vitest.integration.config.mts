// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable import/no-extraneous-dependencies, import/no-default-export */

import { defineConfig } from 'vitest/config';
import path from 'node:path';

const rootDir = process.cwd();

/**
 * Firestore emulator integration tests for repository/service/API behaviour
 * (`tests/emulator/**`). Requires the Firestore emulator on :8080
 * (`yarn test:emulators` or `yarn test:integration`). These tests exercise the
 * real trusted service against the emulator — no mocks, no production creds.
 */
export default defineConfig({
	test: {
		include: ['tests/emulator/**/*.test.{ts,js}'],
		exclude: ['node_modules/**', 'functions/**'],
		testTimeout: 60000,
		hookTimeout: 60000
	},
	resolve: {
		alias: {
			'@': path.join(rootDir, 'src'),
			'@public': path.join(rootDir, 'public'),
			'@assets': path.join(rootDir, 'src/_assets'),
			'@shared': path.join(rootDir, 'src/_shared'),
			'@api': path.join(rootDir, 'src/app/api'),
			'@app': path.join(rootDir, 'src/app'),
			'@ui': path.join(rootDir, 'src/app/_shared-components'),
			'@domain': path.join(rootDir, 'src/domain'),
			'@ports': path.join(rootDir, 'src/ports'),
			'@adapters': path.join(rootDir, 'src/adapters')
		}
	}
});