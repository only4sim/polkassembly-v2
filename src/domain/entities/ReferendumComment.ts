// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * ReferendumComment entity (plan PR-7).
 *
 * Stored in the Firestore subcollection `referenda/{index}/comments/{id}`.
 * Flat (no reply threading) in the first release; all writes go through the
 * trusted API — the client never writes comments directly.
 */
export interface ReferendumComment {
	id: string;
	index: number;
	authorUid: string;
	authorDisplayName: string;
	content: string;
	createdAt: string;
	updatedAt: string;
	schemaVersion: number;
}
