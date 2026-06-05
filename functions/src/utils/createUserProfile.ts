// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { FieldValue } from 'firebase-admin/firestore';
import { INITIAL_USER_POINTS_BALANCE } from '../constants';

type NewUserRecord = {
	uid: string;
	email?: string | null;
	displayName?: string | null;
};

export function createUserProfileDocument(userRecord: NewUserRecord) {
	return {
		uid: userRecord.uid,
		email: userRecord.email || '',
		displayName: userRecord.displayName || userRecord.email?.split('@')[0] || '',
		role: 'user',
		pointsBalance: INITIAL_USER_POINTS_BALANCE,
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp()
	};
}
