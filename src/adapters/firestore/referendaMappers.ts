// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Timestamp, type FieldValue, type Firestore } from 'firebase-admin/firestore';
import { type Referendum, ReferendumStatus } from '@/domain/entities/Referendum';
import { type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';
import { type ReferendumWrite } from '@/ports/repositories/ReferendumRepository';
import { REFERENDUM_SCHEMA_VERSION, STATS_SCHEMA_VERSION, VOTE_SCHEMA_VERSION } from '@/domain/fixtures/referendaFixtures';

/** Centralised Firestore path constants for the referenda domain. */
export const REFERENDA_COLLECTION = 'referenda';
export const REFERENDA_COUNTER_DOC = 'referenda';
export const STATS_DOC_ID = 'current';

export function referendumDoc(db: Firestore, index: number) {
	return db.collection(REFERENDA_COLLECTION).doc(String(index));
}
export function voteDoc(db: Firestore, index: number, uid: string) {
	return referendumDoc(db, index).collection('votes').doc(uid);
}
export function statsDoc(db: Firestore, index: number) {
	return referendumDoc(db, index).collection('stats').doc(STATS_DOC_ID);
}
export function counterDoc(db: Firestore) {
	return db.collection('counters').doc(REFERENDA_COUNTER_DOC);
}

/** Convert a raw Firestore snapshot to a domain Referendum (Timestamps -> ISO strings). */
export function mapReferendum(data: Record<string, unknown>, index: number): Referendum {
	const iso = (v: unknown): string => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : new Date().toISOString());
	return {
		index,
		title: (data.title as string) ?? '',
		content: (data.content as string) ?? '',
		authorUid: (data.authorUid as string) ?? '',
		authorDisplayName: (data.authorDisplayName as string) ?? '',
		origin: (data.origin as Referendum['origin']) ?? 'root',
		status: (data.status as ReferendumStatus) ?? ReferendumStatus.Submitted,
		tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
		votingStartsAt: iso(data.votingStartsAt),
		votingEndsAt: iso(data.votingEndsAt),
		approvalThresholdBps: (data.approvalThresholdBps as number) ?? 0,
		minimumTurnoutPoints: (data.minimumTurnoutPoints as number) ?? 0,
		createdAt: iso(data.createdAt),
		updatedAt: iso(data.updatedAt),
		closedAt: data.closedAt ? iso(data.closedAt) : undefined,
		schemaVersion: (data.schemaVersion as number) ?? REFERENDUM_SCHEMA_VERSION
	};
}

/** Map a raw vote snapshot to a domain ReferendumVote. */
export function mapVote(data: Record<string, unknown>, uid: string): ReferendumVote {
	const iso = (v: unknown): string => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : new Date().toISOString());
	return {
		uid,
		voterDisplayName: (data.voterDisplayName as string) ?? '',
		decision: data.decision as ReferendumVote['decision'],
		pointsUsed: (data.pointsUsed as number) ?? 0,
		balanceAtVote: (data.balanceAtVote as number) ?? 0,
		createdAt: iso(data.createdAt),
		updatedAt: iso(data.updatedAt),
		schemaVersion: (data.schemaVersion as number) ?? VOTE_SCHEMA_VERSION
	};
}

/** Map a raw stats snapshot to a domain ReferendumStats. */
export function mapStats(data: Record<string, unknown>): ReferendumStats {
	const iso = (v: unknown): string => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : new Date().toISOString());
	return {
		ayePoints: (data.ayePoints as number) ?? 0,
		nayPoints: (data.nayPoints as number) ?? 0,
		abstainPoints: (data.abstainPoints as number) ?? 0,
		ayeVoters: (data.ayeVoters as number) ?? 0,
		nayVoters: (data.nayVoters as number) ?? 0,
		abstainVoters: (data.abstainVoters as number) ?? 0,
		totalVoters: (data.totalVoters as number) ?? 0,
		updatedAt: iso(data.updatedAt),
		schemaVersion: (data.schemaVersion as number) ?? STATS_SCHEMA_VERSION
	};
}

/** Field values for writing ISO timestamps (server timestamps where appropriate). */
export function isoOrServer(iso: string): FieldValue | Timestamp {
	return iso ? Timestamp.fromDate(new Date(iso)) : Timestamp.now();
}

/**
 * Prepared Firestore write payload for a referendum. Dates are sent as
 * Firestore Timestamps (matching how the rest of the codebase stores dates).
 */
export function toReferendumWriteData(data: ReferendumWrite): Record<string, unknown> {
	return {
		title: data.title,
		content: data.content,
		authorUid: data.authorUid,
		authorDisplayName: data.authorDisplayName,
		origin: data.origin,
		status: data.status,
		tags: data.tags,
		votingStartsAt: Timestamp.fromDate(new Date(data.votingStartsAt)),
		votingEndsAt: Timestamp.fromDate(new Date(data.votingEndsAt)),
		approvalThresholdBps: data.approvalThresholdBps,
		minimumTurnoutPoints: data.minimumTurnoutPoints,
		schemaVersion: data.schemaVersion
	};
}

export const EMPTY_STATS: ReferendumStats = {
	ayePoints: 0,
	nayPoints: 0,
	abstainPoints: 0,
	ayeVoters: 0,
	nayVoters: 0,
	abstainVoters: 0,
	totalVoters: 0,
	updatedAt: new Date(0).toISOString(),
	schemaVersion: STATS_SCHEMA_VERSION
};

export function emptyStatsData(now: Timestamp): Record<string, unknown> {
	return {
		ayePoints: 0,
		nayPoints: 0,
		abstainPoints: 0,
		ayeVoters: 0,
		nayVoters: 0,
		abstainVoters: 0,
		totalVoters: 0,
		updatedAt: now,
		schemaVersion: STATS_SCHEMA_VERSION
	};
}
