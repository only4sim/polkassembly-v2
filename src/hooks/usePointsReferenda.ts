// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onSnapshot, doc } from 'firebase/firestore';
import { clientDb } from '@/app/_client-services/firebase/firebaseClientApp';
import {
	fetchPointsReferendumDetail,
	fetchPointsReferendumStats,
	fetchMyVote,
	fetchPublicVotes,
	fetchReferendumComments,
	upsertMyVote as apiUpsertVote,
	removeMyVote as apiRemoveVote,
	createPointsReferendum,
	fetchReferendumCapabilities,
	statsDtoFromSnapshotData,
	type PointsReferendaApiError,
	type PublicVotesPage,
	type ReferendumCommentsPage,
	type ReferendumCapabilitiesDto,
	type CreatePointsReferendumInput
} from '@/app/_client-services/points_referenda_client_service';
import type { ReferendumDetailDto, ReferendumStatsDto, ReferendumVoteDto, ReferendumCommentDto } from '@/domain/dtos/ReferendaDtos';
import type { ReferendumDecision } from '@/domain/entities/Referendum';

// ─── Query key factory ───────────────────────────────────────────────────────
// Centralised keys prevent accidental cache collisions and make invalidation
// predictable (F02/F03/F09).

export const referendaKeys = {
	all: ['referenda'] as const,
	lists: () => [...referendaKeys.all, 'list'] as const,
	list: (filters: Record<string, unknown>) => [...referendaKeys.lists(), filters] as const,
	detail: (index: number) => [...referendaKeys.all, 'detail', index] as const,
	stats: (index: number) => [...referendaKeys.all, 'stats', index] as const,
	votes: (index: number, filters?: Record<string, unknown>) => [...referendaKeys.all, 'votes', index, filters] as const,
	myVote: (index: number) => [...referendaKeys.all, 'myVote', index] as const,
	capabilities: (index: number) => [...referendaKeys.all, 'capabilities', index] as const,
	comments: (index: number, page?: number) => [...referendaKeys.all, 'comments', index, { page }] as const
};

// ─── Stats hook with Firestore realtime listener ─────────────────────────────

interface UseReferendumStatsOptions {
	index: number;
	initialData?: ReferendumStatsDto | null;
}

export function useReferendumStats({ index, initialData }: UseReferendumStatsOptions) {
	const queryClient = useQueryClient();
	const queryKey = referendaKeys.stats(index);

	// Seed the cache with SSR data so the first render is hydration-safe.
	useEffect(() => {
		if (initialData !== undefined) {
			queryClient.setQueryData(queryKey, initialData);
		}
	}, [initialData, queryKey, queryClient]);

	// Firestore realtime listener — single source of truth after hydration.
	useEffect(() => {
		const statsRef = doc(clientDb, 'referenda', String(index), 'stats', 'current');
		const unsubscribe = onSnapshot(
			statsRef,
			(snapshot) => {
				if (!snapshot.exists()) {
					queryClient.setQueryData(queryKey, null);
					return;
				}
				const dto = statsDtoFromSnapshotData(snapshot.data() as Record<string, unknown>);
				if (dto) {
					queryClient.setQueryData(queryKey, dto);
				}
			},
			() => {
				// Preserve last known value on listener error; the query stays stale.
			}
		);
		return () => unsubscribe();
	}, [index, queryKey, queryClient]);

	return useQuery<ReferendumStatsDto | null>({
		queryKey,
		queryFn: () => fetchPointsReferendumStats(index),
		staleTime: Infinity,
		gcTime: 5 * 60 * 1000,
		placeholderData: initialData ?? null
	});
}

// ─── Detail hook ─────────────────────────────────────────────────────────────

interface UseReferendumDetailOptions {
	index: number;
	initialData?: ReferendumDetailDto | null;
}

export function useReferendumDetail({ index, initialData }: UseReferendumDetailOptions) {
	return useQuery<ReferendumDetailDto | null>({
		queryKey: referendaKeys.detail(index),
		queryFn: () => fetchPointsReferendumDetail(index),
		staleTime: 60 * 1000,
		placeholderData: initialData ?? null
	});
}

// ─── Own vote hook (identity-aware, F09) ─────────────────────────────────────

interface UseMyVoteOptions {
	index: number;
	uid: string | null;
}

export function useMyVote({ index, uid }: UseMyVoteOptions) {
	const queryKey = referendaKeys.myVote(index);

	// F09 fix: when the UID changes (user switch), immediately clear the cache
	// so stale data from the previous user is never shown.
	const queryClient = useQueryClient();
	useEffect(() => {
		queryClient.setQueryData(queryKey, null);
	}, [uid, queryKey, queryClient]);

	return useQuery<ReferendumVoteDto | null>({
		queryKey,
		queryFn: () => fetchMyVote(index),
		enabled: !!uid,
		staleTime: 30 * 1000,
		retry: 1
	});
}

// ─── Public votes hook (paginated) ───────────────────────────────────────────

interface UsePublicVotesOptions {
	index: number;
	limit?: number;
	page?: number;
	decision?: 'aye' | 'nay' | 'abstain';
	initialData?: PublicVotesPage | null;
}

export function usePublicVotes({ index, limit = 20, page = 1, decision, initialData }: UsePublicVotesOptions) {
	const filters = useMemo(() => ({ limit, page, decision }), [limit, page, decision]);
	return useQuery<PublicVotesPage | null>({
		queryKey: referendaKeys.votes(index, filters),
		queryFn: () => fetchPublicVotes(index, { limit, page, decision }),
		staleTime: 30 * 1000,
		placeholderData: initialData ?? null
	});
}

// ─── Comments hook (paginated) ───────────────────────────────────────────────

interface UseCommentsOptions {
	index: number;
	limit?: number;
	page?: number;
	initialData?: ReferendumCommentsPage | null;
}

export function useReferendumComments({ index, limit = 20, page = 1, initialData }: UseCommentsOptions) {
	return useQuery<ReferendumCommentsPage | null>({
		queryKey: referendaKeys.comments(index, page),
		queryFn: () => fetchReferendumComments(index, { limit, page }),
		staleTime: 30 * 1000,
		placeholderData: initialData ?? null
	});
}

// ─── Vote mutation (F03: invalidates public history + own vote) ──────────────

export function useUpsertVote(index: number) {
	const queryClient = useQueryClient();
	return useMutation<{ vote: ReferendumVoteDto; stats: ReferendumStatsDto }, PointsReferendaApiError | Error, { decision: ReferendumDecision; pointsUsed: number }>({
		mutationFn: (payload) => apiUpsertVote(index, payload.decision, payload.pointsUsed),
		onSuccess: () => {
			// F03 fix: invalidate all dependent queries so public history,
			// own vote, and stats all refresh from the server.
			queryClient.invalidateQueries({ queryKey: referendaKeys.myVote(index) });
			queryClient.invalidateQueries({ queryKey: referendaKeys.votes(index) });
			// Stats are updated by the Firestore listener, but invalidate in
			// case the listener is temporarily disconnected.
			queryClient.invalidateQueries({ queryKey: referendaKeys.stats(index) });
			queryClient.invalidateQueries({ queryKey: referendaKeys.capabilities(index) });
		}
	});
}

export function useRemoveVote(index: number) {
	const queryClient = useQueryClient();
	return useMutation<ReferendumStatsDto, PointsReferendaApiError | Error>({
		mutationFn: () => apiRemoveVote(index),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: referendaKeys.myVote(index) });
			queryClient.invalidateQueries({ queryKey: referendaKeys.votes(index) });
			queryClient.invalidateQueries({ queryKey: referendaKeys.stats(index) });
			queryClient.invalidateQueries({ queryKey: referendaKeys.capabilities(index) });
		}
	});
}

// ─── Create referendum mutation (F04: returns index for navigation) ──────────

export function useCreateReferendum() {
	const queryClient = useQueryClient();
	return useMutation<ReferendumDetailDto, PointsReferendaApiError | Error, CreatePointsReferendumInput>({
		mutationFn: createPointsReferendum,
		onSuccess: () => {
			// Invalidate the list so the new item appears.
			queryClient.invalidateQueries({ queryKey: referendaKeys.lists() });
		}
	});
}

// ─── Capabilities hook (F03: time-boundary aware) ────────────────────────────

export function useCapabilities(index: number) {
	return useQuery<ReferendumCapabilitiesDto | null>({
		queryKey: referendaKeys.capabilities(index),
		queryFn: () => fetchReferendumCapabilities(index),
		// F03 fix: refetch every 30s so time-boundary transitions (voting window
		// opening/closing) are picked up without a full page refresh.
		refetchInterval: 30 * 1000,
		staleTime: 15 * 1000
	});
}

// ─── Comment mutations ───────────────────────────────────────────────────────

export function useAddComment(index: number) {
	const queryClient = useQueryClient();
	return useMutation<ReferendumCommentDto, PointsReferendaApiError | Error, { content: string }>({
		mutationFn: ({ content }) => import('@/app/_client-services/points_referenda_client_service').then((m) => m.addReferendumComment(index, content)),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: referendaKeys.comments(index) });
		}
	});
}

export function useDeleteComment(index: number) {
	const queryClient = useQueryClient();
	return useMutation<void, PointsReferendaApiError | Error, { commentId: string }>({
		mutationFn: ({ commentId }) => import('@/app/_client-services/points_referenda_client_service').then((m) => m.deleteReferendumComment(index, commentId)),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: referendaKeys.comments(index) });
		}
	});
}
