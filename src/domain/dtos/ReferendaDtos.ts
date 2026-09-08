// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

// Wire DTOs for the points-based Referenda API family.
// All dates cross the HTTP boundary as ISO-8601 strings.

import { type ReferendumDecision, type ReferendumStatus, type ReferendumOrigin, type Referendum } from '@/domain/entities/Referendum';
import { approvalBps, participatingPoints, type ReferendumStats } from '@/domain/entities/ReferendumStats';
import { type ReferendumComment } from '@/domain/entities/ReferendumComment';
import { type ReferendumVote } from '@/domain/entities/ReferendumVote';

export interface ReferendumSummaryDto {
	index: number;
	title: string;
	authorUid: string;
	authorDisplayName: string;
	origin: ReferendumOrigin;
	status: ReferendumStatus;
	tags: string[];
	votingStartsAt: string;
	votingEndsAt: string;
	approvalThresholdBps: number;
	minimumTurnoutPoints: number;
	createdAt: string;
}

export interface ReferendumDetailDto extends ReferendumSummaryDto {
	content: string;
	updatedAt: string;
	closedAt?: string;
	schemaVersion: number;
}

export interface ReferendumStatsDto {
	ayePoints: number;
	nayPoints: number;
	abstainPoints: number;
	ayeVoters: number;
	nayVoters: number;
	abstainVoters: number;
	totalVoters: number;
	approvalBps: number;
	participatingPoints: number;
	updatedAt: string;
}

export interface ReferendumVoteDto {
	uid: string;
	voterDisplayName: string;
	decision: ReferendumDecision;
	pointsUsed: number;
	balanceAtVote: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Privacy-safe public vote DTO used by the public vote history endpoint.
 *
 * Frozen contract (PR-1): MUST NOT contain `uid`, `balanceAtVote`, email, role,
 * pointsBalance, or any other private profile field.
 */
export interface PublicReferendumVoteDto {
	voterDisplayName: string;
	decision: ReferendumDecision;
	pointsUsed: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Referendum comment (plan PR-7). Stored in `referenda/{index}/comments/{id}`.
 * `authorUid` is public in the same sense as on referendum summaries (it is
 * needed for ownership-gated delete UI); no email/role/private profile fields.
 */
export interface ReferendumCommentDto {
	id: string;
	index: number;
	authorUid: string;
	authorDisplayName: string;
	content: string;
	createdAt: string;
	updatedAt: string;
}

export interface ReferendaListDto {
	items: ReferendumSummaryDto[];
	totalCount: number;
	page: number;
	pageSize: number;
}

export interface ReferendumVotePayloadDto {
	decision: ReferendumDecision;
	pointsUsed: number;
}

/** Map a domain Referendum to its detail DTO (ISO strings, no Timestamps). */
export function toReferendumDetailDto(r: Referendum): ReferendumDetailDto {
	return {
		index: r.index,
		title: r.title,
		content: r.content,
		authorUid: r.authorUid,
		authorDisplayName: r.authorDisplayName,
		origin: r.origin,
		status: r.status,
		tags: r.tags,
		votingStartsAt: r.votingStartsAt,
		votingEndsAt: r.votingEndsAt,
		approvalThresholdBps: r.approvalThresholdBps,
		minimumTurnoutPoints: r.minimumTurnoutPoints,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
		closedAt: r.closedAt,
		schemaVersion: r.schemaVersion
	};
}

/** Map a domain Referendum to its list-card summary DTO. */
export function toReferendumSummaryDto(r: Referendum): ReferendumSummaryDto {
	return {
		index: r.index,
		title: r.title,
		authorUid: r.authorUid,
		authorDisplayName: r.authorDisplayName,
		origin: r.origin,
		status: r.status,
		tags: r.tags,
		votingStartsAt: r.votingStartsAt,
		votingEndsAt: r.votingEndsAt,
		approvalThresholdBps: r.approvalThresholdBps,
		minimumTurnoutPoints: r.minimumTurnoutPoints,
		createdAt: r.createdAt
	};
}

/** Map domain stats + thresholds to the wire DTO, computing approval/turnout. */
export function toReferendumStatsDto(stats: ReferendumStats): ReferendumStatsDto {
	return {
		ayePoints: stats.ayePoints,
		nayPoints: stats.nayPoints,
		abstainPoints: stats.abstainPoints,
		ayeVoters: stats.ayeVoters,
		nayVoters: stats.nayVoters,
		abstainVoters: stats.abstainVoters,
		totalVoters: stats.totalVoters,
		approvalBps: approvalBps(stats),
		participatingPoints: participatingPoints(stats),
		updatedAt: stats.updatedAt
	};
}

/** Map a domain vote to its wire DTO. */
export function toReferendumVoteDto(v: ReferendumVote): ReferendumVoteDto {
	return {
		uid: v.uid,
		voterDisplayName: v.voterDisplayName,
		decision: v.decision,
		pointsUsed: v.pointsUsed,
		balanceAtVote: v.balanceAtVote,
		createdAt: v.createdAt,
		updatedAt: v.updatedAt
	};
}

/**
 * Map a domain vote to its public (privacy-safe) wire DTO.
 *
 * Frozen contract (PR-1): the public history endpoint must only expose
 * display name, decision, points and timestamps. `uid` and `balanceAtVote`
 * are audit fields reserved for the owner's own `/votes/me` response.
 */
export function toPublicReferendumVoteDto(v: ReferendumVote): PublicReferendumVoteDto {
	return {
		voterDisplayName: v.voterDisplayName,
		decision: v.decision,
		pointsUsed: v.pointsUsed,
		createdAt: v.createdAt,
		updatedAt: v.updatedAt
	};
}

/** Map a domain referendum comment to its wire DTO (plan PR-7). */
export function toReferendumCommentDto(c: ReferendumComment): ReferendumCommentDto {
	return {
		id: c.id,
		index: c.index,
		authorUid: c.authorUid,
		authorDisplayName: c.authorDisplayName,
		content: c.content,
		createdAt: c.createdAt,
		updatedAt: c.updatedAt
	};
}
