// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Poll definition — embedded inside a DemoPost document.
 *
 * Stored as a nested object in `posts/{postId}`.
 */
export interface Poll {
	/** The question being asked. */
	question: string;
	/** Display labels for each option, e.g. ["Option A", "Option B"]. */
	options: string[];
	/** Optional poll deadline. */
	endDate?: Date;
}
