// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Shared firebase-admin initialisation for server-side (Next.js API route) code.
 *
 * Mirrors the existing pattern used by `FirestoreUserRepository` and the vote API
 * route so the Admin SDK is initialised exactly once with consistent emulator env
 * routing for local development.
 */

import * as admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';

// Route emulator env vars before the Admin SDK is first used (idempotent).
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
	process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
	process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
}

if (!admin.apps.length) {
	if (FIREBASE_SERVICE_ACC_CONFIG) {
		admin.initializeApp({
			credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACC_CONFIG))
		});
	} else {
		admin.initializeApp({
			projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cbs-assembly'
		});
	}
}

/** Admin SDK authenticated database handle (God-mode; bypasses security rules). */
export function getAdminDb(): admin.firestore.Firestore {
	return admin.firestore();
}

export { admin };
