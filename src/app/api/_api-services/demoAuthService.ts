// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as firebaseAdmin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';

// In development, always ensure emulator env vars are set regardless of whether
// firebase-admin has already been initialized by another module. These must be
// present before the first admin.auth().verifyIdToken() call.
// Use ||= (not ??=) so an empty-string value is also overridden.
if (process.env.NODE_ENV === 'development') {
	process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099';
	process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
}

if (!firebaseAdmin.apps.length) {
	if (FIREBASE_SERVICE_ACC_CONFIG) {
		firebaseAdmin.initializeApp({
			credential: firebaseAdmin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACC_CONFIG))
		});
	} else if (process.env.NODE_ENV === 'development') {
		firebaseAdmin.initializeApp({
			projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cbs-assembly'
		});
	}
}

export class DemoAuthService {
	/**
	 * Verify a Firebase ID token sent from the client.
	 * Returns the decoded token payload on success, or null on failure.
	 *
	 * In development (emulator) mode: if the Admin SDK fails for any reason
	 * (e.g. FIREBASE_AUTH_EMULATOR_HOST misconfigured or empty), we fall back
	 * to directly decoding the JWT payload without signature verification.
	 * This is safe for local development only — never reaches production.
	 */
	static async verifyIdToken(idToken: string): Promise<firebaseAdmin.auth.DecodedIdToken | null> {
		try {
			return await firebaseAdmin.auth().verifyIdToken(idToken);
		} catch (adminErr) {
			if (process.env.NODE_ENV !== 'development') return null;

			// Development fallback: decode the JWT payload directly.
			// Firebase Auth emulator tokens may use a non-standard signing key that
			// the Admin SDK rejects when FIREBASE_AUTH_EMULATOR_HOST is not set or
			// is misconfigured. Decoding without verification is acceptable in a
			// local-only demo environment.
			// eslint-disable-next-line no-console
			console.warn('[DemoAuthService] Admin SDK verifyIdToken failed, using JWT decode fallback:', (adminErr as Error).message);
			try {
				const parts = idToken.split('.');
				if (parts.length !== 3) return null;
				// Base64url → base64: replace URL-safe chars, then pad to a multiple of 4
				const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
				const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
				const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;

				// Validate issuer — must be a Firebase securetoken URL.
				// NOTE: This entire fallback is only reachable in development (NODE_ENV check
				// at the top of the catch block). We do NOT restrict to a specific project ID
				// because the emulator's project (from .firebaserc, e.g. 'cbs-assembly') may
				// differ from NEXT_PUBLIC_FIREBASE_PROJECT_ID. Expiry + uid checks below provide
				// sufficient safety for a local-only dev environment.
				if (typeof payload.iss !== 'string' || !payload.iss.startsWith('https://securetoken.google.com/')) return null;

				// Reject expired tokens even in fallback mode
				if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null;

				// Explicitly map only the fields we use (uid/sub, email, name)
				const uid = (typeof payload.uid === 'string' ? payload.uid : typeof payload.sub === 'string' ? payload.sub : null);
				if (!uid) return null;

				return {
					uid,
					sub: uid,
					iss: payload.iss as string,
					aud: payload.aud as string,
					iat: payload.iat as number,
					exp: payload.exp as number,
					email: payload.email as string | undefined,
					name: payload.name as string | undefined,
					firebase: payload.firebase as firebaseAdmin.auth.DecodedIdToken['firebase']
				} as firebaseAdmin.auth.DecodedIdToken;
			} catch {
				return null;
			}
		}
	}
}
