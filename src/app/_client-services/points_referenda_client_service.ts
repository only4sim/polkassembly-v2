// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Unified client service for the points-based Referenda (DemoOS mode).
 *
 * Frozen contract (plan PR-5): ALL browser-side Referenda calls go through this
 * module — Demo components must not perform raw `fetch` calls. It centralises:
 *   - URL/query generation
 *   - Firebase auth readiness and ID-token headers
 *   - `response.ok` enforcement and standard error parsing (`{ message }`)
 *   - DTO runtime validation (never trust an error body as a vote)
 *
 * Client-safe imports only: firebase client SDK + pure domain DTOs. This file
 * must never import firebase-admin, Next server utils, or @polkadot/*.
 */

import { onAuthStateChanged, type User } from 'firebase/auth';
import { clientAuth } from '@/app/_client-services/firebase/firebaseClientApp';
import {
	type PublicReferendumVoteDto,
	type ReferendaListDto,
	type ReferendumDetailDto,
	type ReferendumStatsDto,
	type ReferendumSummaryDto,
	type ReferendumVoteDto
} from '@/domain/dtos/ReferendaDtos';
import { type ReferendumDecision, ReferendumDecision as EDecision, ReferendumStatus as EStatus } from '@/domain/entities/Referendum';

// ---------------------------------------------------------------------------
// Cache keys (points-specific — never reuse the chain Referenda cache keys)
// ---------------------------------------------------------------------------

export const POINTS_REFERENDA_KEYS = {
	all: ['points-referenda'] as const,
	list: (page: number, statuses: string[], origin?: string) => [...POINTS_REFERENDA_KEYS.all, 'list', { page, statuses, origin }] as const,
	detail: (index: number) => [...POINTS_REFERENDA_KEYS.all, 'detail', index] as const,
	stats: (index: number) => [...POINTS_REFERENDA_KEYS.all, 'stats', index] as const,
	myVote: (index: number) => [...POINTS_REFERENDA_KEYS.all, 'myVote', index] as const,
	publicVotes: (index: number) => [...POINTS_REFERENDA_KEYS.all, 'publicVotes', index] as const
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PointsReferendaApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'PointsReferendaApiError';
		this.status = status;
	}
}

const API_BASE = '/api/v2/referenda';

// ---------------------------------------------------------------------------
// Auth readiness
// ---------------------------------------------------------------------------

let authReadyPromise: Promise<User | null> | null = null;

/**
 * Resolves exactly once when the Firebase client auth has restored its session
 * (user or anonymous). Callers should treat `null` as "definitely not logged
 * in" rather than "still loading".
 */
export function waitForAuthReady(): Promise<User | null> {
	if (!authReadyPromise) {
		authReadyPromise = new Promise<User | null>((resolve) => {
			const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
				resolve(user);
				unsubscribe();
			});
		});
	}
	return authReadyPromise;
}

/**
 * Authorization headers for the current user, or `{}` when anonymous. Uses the
 * live `currentUser` after readiness so logout/switch is honoured immediately.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
	await waitForAuthReady();
	const user = clientAuth.currentUser;
	if (!user) return {};
	const token = await user.getIdToken();
	return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// DTO runtime validation
// ---------------------------------------------------------------------------

const isSafeNonNegativeInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isIsoDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

const DECISIONS: readonly string[] = [EDecision.AYE, EDecision.NAY, EDecision.ABSTAIN];

/** Validate + normalise a wire vote object. Returns null for anything malformed. */
export function voteDtoFromJson(json: unknown): ReferendumVoteDto | null {
	if (!json || typeof json !== 'object') return null;
	const v = json as Record<string, unknown>;
	if (!isNonEmptyString(v.uid) || !isNonEmptyString(v.voterDisplayName)) return null;
	if (!DECISIONS.includes(v.decision as string)) return null;
	if (!isSafeNonNegativeInt(v.pointsUsed) || !isSafeNonNegativeInt(v.balanceAtVote)) return null;
	if (!isIsoDate(v.createdAt) || !isIsoDate(v.updatedAt)) return null;
	return {
		uid: v.uid,
		voterDisplayName: v.voterDisplayName,
		decision: v.decision as ReferendumDecision,
		pointsUsed: v.pointsUsed,
		balanceAtVote: v.balanceAtVote,
		createdAt: v.createdAt,
		updatedAt: v.updatedAt
	};
}

/** Privacy-safe public vote validation (no uid/balanceAtVote by contract). */
export function publicVoteDtoFromJson(json: unknown): PublicReferendumVoteDto | null {
	if (!json || typeof json !== 'object') return null;
	const v = json as Record<string, unknown>;
	// Privacy guard (plan PR-5): a public entry carrying `uid` or
	// `balanceAtVote` is a contract violation — fail loudly instead of
	// silently forwarding private data.
	if ('uid' in v || 'balanceAtVote' in v) return null;
	if (!isNonEmptyString(v.voterDisplayName)) return null;
	if (!DECISIONS.includes(v.decision as string)) return null;
	if (!isSafeNonNegativeInt(v.pointsUsed)) return null;
	if (!isIsoDate(v.createdAt) || !isIsoDate(v.updatedAt)) return null;
	return {
		voterDisplayName: v.voterDisplayName,
		decision: v.decision as ReferendumDecision,
		pointsUsed: v.pointsUsed,
		createdAt: v.createdAt,
		updatedAt: v.updatedAt
	};
}

const STAT_NUMERIC_FIELDS = ['ayePoints', 'nayPoints', 'abstainPoints', 'ayeVoters', 'nayVoters', 'abstainVoters', 'totalVoters', 'approvalBps', 'participatingPoints'] as const;

/** Validate a stats payload; returns null when malformed. */
export function statsDtoFromJson(json: unknown): ReferendumStatsDto | null {
	if (!json || typeof json !== 'object') return null;
	const s = json as Record<string, unknown>;
	const allNumeric = STAT_NUMERIC_FIELDS.every((field) => isSafeNonNegativeInt(s[field]));
	if (!allNumeric || !isIsoDate(s.updatedAt)) return null;
	return {
		ayePoints: s.ayePoints as number,
		nayPoints: s.nayPoints as number,
		abstainPoints: s.abstainPoints as number,
		ayeVoters: s.ayeVoters as number,
		nayVoters: s.nayVoters as number,
		abstainVoters: s.abstainVoters as number,
		totalVoters: s.totalVoters as number,
		approvalBps: s.approvalBps as number,
		participatingPoints: s.participatingPoints as number,
		updatedAt: s.updatedAt
	};
}

/** Map a raw Firestore stats snapshot (client SDK) to the wire DTO. */
export function statsDtoFromSnapshotData(data: Record<string, unknown>): ReferendumStatsDto | null {
	const raw: Record<string, unknown> = { ...data };
	const ts = raw.updatedAt as { toDate?: () => Date } | undefined;
	raw.updatedAt = ts?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
	return statsDtoFromJson(raw);
}

const SUMMARY_STATUSES: readonly string[] = [EStatus.Submitted, EStatus.Deciding, EStatus.Confirmed, EStatus.Rejected, EStatus.Cancelled];

function summaryDtoFromJson(json: unknown): ReferendumSummaryDto | null {
	if (!json || typeof json !== 'object') return null;
	const s = json as Record<string, unknown>;
	if (typeof s.index !== 'number' || !Number.isSafeInteger(s.index)) return null;
	if (!isNonEmptyString(s.title) || !isNonEmptyString(s.authorDisplayName)) return null;
	if (!SUMMARY_STATUSES.includes(s.status as string)) return null;
	if (!isIsoDate(s.votingStartsAt) || !isIsoDate(s.votingEndsAt) || !isIsoDate(s.createdAt)) return null;
	if (!isSafeNonNegativeInt(s.approvalThresholdBps) || !isSafeNonNegativeInt(s.minimumTurnoutPoints)) return null;
	if (!Array.isArray(s.tags) || !s.tags.every((t) => typeof t === 'string')) return null;
	return s as unknown as ReferendumSummaryDto;
}

export function detailDtoFromJson(json: unknown): ReferendumDetailDto | null {
	if (!json || typeof json !== 'object') return null;
	const summary = summaryDtoFromJson(json);
	if (!summary) return null;
	const d = json as Record<string, unknown>;
	if (!isNonEmptyString(d.content) || !isIsoDate(d.updatedAt)) return null;
	return {
		...summary,
		content: d.content,
		updatedAt: d.updatedAt,
		closedAt: typeof d.closedAt === 'string' ? d.closedAt : undefined,
		schemaVersion: typeof d.schemaVersion === 'number' ? d.schemaVersion : 1
	};
}

function listDtoFromJson(json: unknown): ReferendaListDto | null {
	if (!json || typeof json !== 'object') return null;
	const l = json as Record<string, unknown>;
	if (!Array.isArray(l.items)) return null;
	const items: ReferendumSummaryDto[] = [];
	for (let i = 0; i < l.items.length; i += 1) {
		const item = summaryDtoFromJson(l.items[i]);
		if (!item) return null;
		items.push(item);
	}
	if (!isSafeNonNegativeInt(l.totalCount) || typeof l.page !== 'number' || typeof l.pageSize !== 'number') return null;
	return { items, totalCount: l.totalCount, page: l.page, pageSize: l.pageSize };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

async function parseErrorBody(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as { message?: unknown };
		if (body && isNonEmptyString(body.message)) return body.message;
	} catch {
		// fall through
	}
	return `Request failed with status ${res.status}.`;
}

async function requestJson(url: string, init: Parameters<typeof fetch>[1]): Promise<unknown> {
	const res = await fetch(url, init);
	if (!res.ok) throw new PointsReferendaApiError(res.status, await parseErrorBody(res));
	return res.json();
}

// ---------------------------------------------------------------------------
// Read endpoints
// ---------------------------------------------------------------------------

export interface PointsReferendaListParams {
	page: number;
	pageSize: number;
	statuses?: string[];
	origin?: string;
}

export async function fetchPointsReferendaList(params: PointsReferendaListParams): Promise<ReferendaListDto> {
	const search = new URLSearchParams();
	search.set('page', String(Math.max(1, Math.floor(params.page))));
	search.set('pageSize', String(Math.max(1, Math.floor(params.pageSize))));
	if (params.statuses?.length) search.set('status', params.statuses.join(','));
	if (params.origin) search.set('origin', params.origin);
	const json = await requestJson(`${API_BASE}?${search.toString()}`, { method: 'GET' });
	const dto = listDtoFromJson(json);
	if (!dto) throw new PointsReferendaApiError(502, 'Malformed list response.');
	return dto;
}

/**
 * Detail by index. Returns null ONLY for 404 (not found); any other failure
 * (including malformed bodies) throws so callers can distinguish errors from
 * empty states.
 */
export async function fetchPointsReferendumDetail(index: number): Promise<ReferendumDetailDto | null> {
	try {
		const json = await requestJson(`${API_BASE}/${index}`, { method: 'GET' });
		const dto = detailDtoFromJson(json);
		if (!dto) throw new PointsReferendaApiError(502, 'Malformed referendum response.');
		return dto;
	} catch (err) {
		if (err instanceof PointsReferendaApiError && err.status === 404) return null;
		throw err;
	}
}

export async function fetchPointsReferendumStats(index: number): Promise<ReferendumStatsDto | null> {
	try {
		const json = await requestJson(`${API_BASE}/${index}/stats`, { method: 'GET' });
		return statsDtoFromJson(json);
	} catch (err) {
		if (err instanceof PointsReferendaApiError && err.status === 404) return null;
		throw err;
	}
}

/**
 * The authenticated user's own vote. Returns null when the user has no vote;
 * throws (401 etc.) otherwise — an error body is never mistaken for a vote.
 */
export async function fetchMyVote(index: number): Promise<ReferendumVoteDto | null> {
	const headers = await getAuthHeaders();
	if (!headers.Authorization) return null; // anonymous → no own vote
	try {
		const json = await requestJson(`${API_BASE}/${index}/votes/me`, { method: 'GET', headers });
		if (!json || typeof json !== 'object') return null;
		return voteDtoFromJson((json as Record<string, unknown>).vote);
	} catch (err) {
		if (err instanceof PointsReferendaApiError && err.status === 404) return null;
		throw err;
	}
}

export interface PublicVotesPage {
	items: PublicReferendumVoteDto[];
	totalCount: number;
}

export async function fetchPublicVotes(index: number, limit = 50): Promise<PublicVotesPage> {
	const json = await requestJson(`${API_BASE}/${index}/votes?limit=${Math.max(1, Math.floor(limit))}`, { method: 'GET' });
	if (!json || typeof json !== 'object') throw new PointsReferendaApiError(502, 'Malformed vote history response.');
	const body = json as Record<string, unknown>;
	if (!Array.isArray(body.items) || !isSafeNonNegativeInt(body.totalCount)) throw new PointsReferendaApiError(502, 'Malformed vote history response.');
	const items: PublicReferendumVoteDto[] = [];
	for (let i = 0; i < body.items.length; i += 1) {
		const dto = publicVoteDtoFromJson(body.items[i]);
		if (!dto) throw new PointsReferendaApiError(502, 'Malformed vote history entry.');
		items.push(dto);
	}
	return { items, totalCount: body.totalCount };
}

// ---------------------------------------------------------------------------
// Trusted mutations
// ---------------------------------------------------------------------------

export interface CreatePointsReferendumInput {
	title: string;
	content: string;
	origin: string;
	tags?: string[];
	votingStartsAt: string;
	votingEndsAt: string;
	approvalThresholdBps: number;
	minimumTurnoutPoints: number;
}

export async function createPointsReferendum(input: CreatePointsReferendumInput): Promise<ReferendumDetailDto> {
	const headers = await getAuthHeaders();
	const json = await requestJson(API_BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify(input)
	});
	if (!json || typeof json !== 'object') throw new PointsReferendaApiError(502, 'Malformed creation response.');
	const dto = detailDtoFromJson((json as Record<string, unknown>).referendum);
	if (!dto) throw new PointsReferendaApiError(502, 'Malformed creation response.');
	return dto;
}

export async function upsertMyVote(index: number, decision: ReferendumDecision, pointsUsed: number): Promise<{ vote: ReferendumVoteDto; stats: ReferendumStatsDto }> {
	const headers = await getAuthHeaders();
	const json = await requestJson(`${API_BASE}/${index}/votes/me`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify({ decision, pointsUsed })
	});
	if (!json || typeof json !== 'object') throw new PointsReferendaApiError(502, 'Malformed vote response.');
	const body = json as Record<string, unknown>;
	const vote = voteDtoFromJson(body.vote);
	const stats = statsDtoFromJson(body.stats);
	if (!vote || !stats) throw new PointsReferendaApiError(502, 'Malformed vote response.');
	return { vote, stats };
}

export async function removeMyVote(index: number): Promise<ReferendumStatsDto> {
	const headers = await getAuthHeaders();
	const json = await requestJson(`${API_BASE}/${index}/votes/me`, { method: 'DELETE', headers });
	if (!json || typeof json !== 'object') throw new PointsReferendaApiError(502, 'Malformed removal response.');
	const stats = statsDtoFromJson((json as Record<string, unknown>).stats);
	if (!stats) throw new PointsReferendaApiError(502, 'Malformed removal response.');
	return stats;
}

export interface ReferendumCapabilitiesDto {
	isVotingOpen: boolean;
	isClosed: boolean;
	canVote: boolean;
	canChangeVote: boolean;
	canRemoveVote: boolean;
	canCancel: boolean;
	/** Authoritative points balance for the verified user; null when anonymous/unknown. */
	pointsBalance: number | null;
}

/**
 * Trusted, server-derived capabilities (incl. admin flag and pointsBalance).
 * Returns null only for 404 (referendum gone); otherwise throws.
 */
export async function fetchReferendumCapabilities(index: number): Promise<ReferendumCapabilitiesDto | null> {
	const headers = await getAuthHeaders();
	try {
		const json = await requestJson(`${API_BASE}/${index}/capabilities`, { method: 'GET', headers });
		if (!json || typeof json !== 'object') throw new PointsReferendaApiError(502, 'Malformed capabilities response.');
		const c = json as Record<string, unknown>;
		const balance = c.pointsBalance === null ? null : isSafeNonNegativeInt(c.pointsBalance) ? (c.pointsBalance as number) : null;
		return {
			isVotingOpen: c.isVotingOpen === true,
			isClosed: c.isClosed === true,
			canVote: c.canVote === true,
			canChangeVote: c.canChangeVote === true,
			canRemoveVote: c.canRemoveVote === true,
			canCancel: c.canCancel === true,
			pointsBalance: balance
		};
	} catch (err) {
		if (err instanceof PointsReferendaApiError && err.status === 404) return null;
		throw err;
	}
}

export async function cancelReferendum(index: number): Promise<void> {
	const headers = await getAuthHeaders();
	await requestJson(`${API_BASE}/${index}`, { method: 'DELETE', headers });
}
