// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as logger from 'firebase-functions/logger';
import { auth } from 'firebase-functions/v1';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

// Ensure Firebase Admin is initialized
if (getApps().length === 0) {
	initializeApp();
}

/**
 * Cloud Function triggered when a new Firebase Auth user is created.
 * Auto-creates a user profile document at users/{uid} with default values.
 */
export const onAuthUserCreated = auth.user().onCreate(async (userRecord) => {
	const db = getFirestore();

	try {
		await db
			.collection('users')
			.doc(userRecord.uid)
			.set({
				uid: userRecord.uid,
				email: userRecord.email || '',
				displayName: userRecord.displayName || userRecord.email?.split('@')[0] || '',
				role: 'user',
				pointsBalance: 0,
				createdAt: FieldValue.serverTimestamp(),
				updatedAt: FieldValue.serverTimestamp()
			});

		logger.info(`User profile created for uid: ${userRecord.uid}`);
	} catch (error) {
		logger.error(`Error creating user profile for uid: ${userRecord.uid}`, error);
	}
});
