// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as logger from 'firebase-functions/logger';
import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

// Ensure Firebase Admin is initialized
if (getApps().length === 0) {
	initializeApp();
}

/**
 * Cloud Function triggered before a new Firebase Auth user is created.
 * Auto-creates a user profile document at users/{uid} with default values.
 */
export const onAuthUserCreated = beforeUserCreated(async (event) => {
	if (!event.data) {
		logger.error('No user data in event');
		return;
	}

	const { uid, email, displayName } = event.data;

	const db = getFirestore();

	try {
		await db
			.collection('users')
			.doc(uid)
			.set({
				uid,
				email: email || '',
				displayName: displayName || '',
				role: 'user',
				pointsBalance: 0,
				createdAt: FieldValue.serverTimestamp(),
				updatedAt: FieldValue.serverTimestamp()
			});

		logger.info(`User profile created for uid: ${uid}`);
	} catch (error) {
		logger.error(`Error creating user profile for uid: ${uid}`, error);
	}
});
