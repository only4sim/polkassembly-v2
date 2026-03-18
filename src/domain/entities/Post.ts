// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * DemoPost entity for DemoOS discussion posts.
 *
 * Posts are stored in the Firestore `posts` collection.
 * The `id` field corresponds to the Firestore document ID (auto-generated string).
 */
export interface DemoPost {
	id: string;
	title: string;
	content: string;
	authorUid: string;
	authorName: string;
	createdAt: Date;
	updatedAt: Date;
}
