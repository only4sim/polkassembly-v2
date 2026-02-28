// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { ERROR_CODES } from '@/_shared/_constants/errorLiterals';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';
import { APIError } from '@/app/api/_api-utils/apiError';
import * as firebaseAdmin from 'firebase-admin';
import { StatusCodes } from 'http-status-codes';

// init firebase admin
if (FIREBASE_SERVICE_ACC_CONFIG) {
	try {
		if (!firebaseAdmin.apps.length) {
			firebaseAdmin.initializeApp({
				credential: firebaseAdmin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACC_CONFIG))
			});
		}
	} catch (error: unknown) {
		console.error('\nError in initialising firebase-admin: ', error, '\n');
		throw new APIError(ERROR_CODES.INTERNAL_SERVER_ERROR, StatusCodes.INTERNAL_SERVER_ERROR, 'Error in initialising firebase-admin.');
	}
} else if (process.env.NODE_ENV === 'development' && !firebaseAdmin.apps.length) {
	// Emulator mode: initialise without credentials so the SDK connects to local emulators
	firebaseAdmin.initializeApp();
	console.log('\n ℹ️ Firebase Admin initialised without credentials (emulator / development mode).\n');
} else {
	console.log('\n ℹ️ [disabled] FIREBASE_SERVICE_ACC_CONFIG is not set. Firestore operations will fail if called.\n');
}

export class FirestoreUtils {
	private static _firestoreDb: firebaseAdmin.firestore.Firestore | null = null;

	/* eslint-disable no-underscore-dangle */
	protected static get firestoreDb(): firebaseAdmin.firestore.Firestore {
		if (!this._firestoreDb) {
			if (!firebaseAdmin.apps.length) {
				throw new APIError(ERROR_CODES.INTERNAL_SERVER_ERROR, StatusCodes.INTERNAL_SERVER_ERROR, 'FIREBASE_SERVICE_ACC_CONFIG is not set. Firestore is unavailable.');
			}
			this._firestoreDb = firebaseAdmin.firestore();
		}
		return this._firestoreDb;
	}
	/* eslint-enable no-underscore-dangle */

	protected static increment = firebaseAdmin.firestore.FieldValue.increment;

	protected static serverTimestamp = firebaseAdmin.firestore.FieldValue.serverTimestamp;

	// collection references
	protected static usersCollectionRef = () => this.firestoreDb.collection('users');

	protected static addressesCollectionRef = () => this.firestoreDb.collection('addresses');

	protected static postsCollectionRef = () => this.firestoreDb.collection('posts');

	protected static commentsCollectionRef = () => this.firestoreDb.collection('comments');

	protected static notificationsCollectionRef = () => this.firestoreDb.collection('notifications');

	protected static apiKeysCollectionRef = () => this.firestoreDb.collection('api_keys');

	protected static reactionsCollectionRef = () => this.firestoreDb.collection('reactions');

	protected static userActivityCollectionRef = () => this.firestoreDb.collection('user_activities');

	protected static contentSummariesCollectionRef = () => this.firestoreDb.collection('content_summaries');

	protected static followersCollectionRef = () => this.firestoreDb.collection('followers');

	protected static tagsCollectionRef = () => this.firestoreDb.collection('tags');

	protected static voteCartItemsCollectionRef = () => this.firestoreDb.collection('vote_cart_items');

	protected static postSubscriptionsCollectionRef = () => this.firestoreDb.collection('post_subscriptions');

	protected static treasuryStatsCollectionRef = () => this.firestoreDb.collection('treasury_stats');

	protected static delegatesCollectionRef = () => this.firestoreDb.collection('delegates');

	protected static userSocialsCollectionRef = () => this.firestoreDb.collection('user_socials');

	protected static pollsCollectionRef = () => this.firestoreDb.collection('polls');

	protected static delegateXAccountsCollectionRef = () => this.firestoreDb.collection('delegate_x_accounts');

	protected static delegateXVotesCollectionRef = () => this.firestoreDb.collection('delegate_x_votes');

	// klara collection references
	protected static conversationsCollectionRef = () => this.firestoreDb.collection('klara_conversations');

	protected static messagesCollectionRef = () => this.firestoreDb.collection('klara_messages');
}
