// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { DocumentData } from 'firebase-admin/firestore';
import dayjs from 'dayjs';
import * as logger from 'firebase-functions/logger';
import { IV2User } from '../types';
import { initAlgoliaApi } from './initAlgoliaApi';

export const updateUserAlgolia = async (user?: DocumentData, userDocId?: string): Promise<void> => {
	if (!user) {
		return;
	}

	const client = initAlgoliaApi();
	if (!client) return;

	const uid = typeof user.uid === 'string' && user.uid.trim() ? user.uid.trim() : typeof userDocId === 'string' ? userDocId.trim() : '';
	const userIdentifier = uid || user.id;
	if (userIdentifier === undefined || userIdentifier === null) {
		logger.warn('User identifier is missing (id/uid/docId) - skipping Algolia user sync.');
		return;
	}

	const objectID = userIdentifier.toString();
	const normalizedId = user.id ?? uid ?? objectID;
	const username =
		typeof user.username === 'string' && user.username.trim()
			? user.username.trim()
			: typeof user.displayName === 'string' && user.displayName.trim()
				? user.displayName.trim()
				: typeof user.email === 'string' && user.email.includes('@')
					? user.email.split('@')[0]
					: '';
	const bio = typeof user.profileDetails?.bio === 'string' ? user.profileDetails.bio : '';

	const algoliaUser: Omit<IV2User, 'password' | 'salt' | 'isEmailVerified' | 'isWeb3Signup' | 'createdAt' | 'updatedAt' | 'id'> & {
		objectID: string;
		id: number | string;
		uid?: string;
		createdAtTimestamp?: number;
		updatedAtTimestamp?: number;
		displayName?: string;
		profile?: { bio?: string };
	} = {
		objectID,
		id: normalizedId,
		uid: uid || undefined,
		username,
		displayName: user.displayName || username,
		email: user.email,
		...(user.createdAt && { createdAtTimestamp: dayjs(user.createdAt.toDate()).unix() }),
		...(user.updatedAt && { updatedAtTimestamp: dayjs(user.updatedAt.toDate()).unix() }),
		primaryNetwork: user.primaryNetwork,
		profileDetails: {
			...(user.profileDetails || {}),
			bio
		},
		profile: {
			bio
		}
	};

	await client.saveObject({
		indexName: 'polkassembly_v2_users',
		body: algoliaUser
	});

	if (user.id !== undefined && user.id !== null) {
		const legacyObjectID = user.id.toString();
		if (legacyObjectID !== objectID) {
			try {
				await client.deleteObject({
					indexName: 'polkassembly_v2_users',
					objectID: legacyObjectID
				});
				logger.info(`Deleted legacy Algolia user record: ${legacyObjectID}`);
			} catch (error) {
				logger.warn(`Failed to delete legacy Algolia user record ${legacyObjectID}:`, error);
			}
		}
	}
};
