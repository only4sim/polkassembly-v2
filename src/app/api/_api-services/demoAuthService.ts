// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as firebaseAdmin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';

if (FIREBASE_SERVICE_ACC_CONFIG && !firebaseAdmin.apps.length) {
	firebaseAdmin.initializeApp({
		credential: firebaseAdmin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACC_CONFIG))
	});
}

export class DemoAuthService {
	/**
	 * Verify a Firebase ID token sent from the client.
	 * Returns the decoded token payload on success, or null on failure.
	 */
	static async verifyIdToken(idToken: string): Promise<firebaseAdmin.auth.DecodedIdToken | null> {
		try {
			return await firebaseAdmin.auth().verifyIdToken(idToken);
		} catch {
			return null;
		}
	}
}
