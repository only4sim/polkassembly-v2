// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Activity event types for the referenda lifecycle (F16/P7).
 *
 * Events are written transactionally alongside business state changes and
 * represent ACTUAL occurrences (not scheduled/planned times). The public
 * activity feed reads these in reverse chronological order.
 *
 * Privacy: events MUST NOT contain voter UID, balance, or admin-private data.
 */
export type ReferendaActivityEventType =
	| 'created'
	| 'voting_opened'
	| 'vote_cast'
	| 'vote_changed'
	| 'vote_removed'
	| 'confirmed'
	| 'rejected'
	| 'cancelled'
	| 'discussion_locked'
	| 'discussion_unlocked';

export interface ReferendaActivityEvent {
	id: string;
	/** The referendum index this event relates to. */
	index: number;
	/** Event type discriminator. */
	type: ReferendaActivityEventType;
	/** ISO-8601 timestamp of when the event ACTUALLY occurred (server time). */
	occurredAt: string;
	/** Display name of the actor (public-safe, no UID). */
	actorDisplayName?: string;
	/** Optional human-readable summary for the activity feed. */
	summary?: string;
	/** Schema version for forward compatibility. */
	schemaVersion: number;
}

export const ACTIVITY_EVENT_SCHEMA_VERSION = 1;
