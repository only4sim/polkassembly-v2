// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable import/no-extraneous-dependencies, import/no-default-export */

import { defineConfig } from 'vitest/config';
import path from 'node:path';

const rootDir = process.cwd();

export default defineConfig({
	test: {
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		exclude: ['node_modules/**', 'functions/**', '.next/**', 'tests/firestore/**']
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
