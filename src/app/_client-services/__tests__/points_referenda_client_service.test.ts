// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * F01 regression test: Client-side stats mapper must correctly compute
 * derived fields (approvalBps, participatingPoints) from raw Firestore data.
 *
 * The Firestore stats document does NOT store approvalBps or participatingPoints.
 * These must be computed on the client side from the raw stats fields.
 *
 * Test input from production mapper/writer structure:
 *   ayePoints=60, nayPoints=40, abstainPoints=10,
 *   ayeVoters=1, nayVoters=1, abstainVoters=1, totalVoters=3,
 *   updatedAt=Timestamp, schemaVersion=1
 *
 * Expected DTO:
 *   approvalBps=6000, participatingPoints=110
 */

import { describe, expect, it, vi } from 'vitest';
import { statsDtoFromJson, statsDtoFromSnapshotData } from '../points_referenda_client_service';

// Mock Firebase modules before importing the service
vi.mock('@/app/_client-services/firebase/firebaseClientApp', () => ({
	clientAuth: {},
	clientDb: {},
	clientFunctions: {}
}));

vi.mock('firebase/auth', () => ({
	onAuthStateChanged: vi.fn()
}));

const TEST_ISO_DATE = '2026-10-01T12:00:00.000Z';

describe('F01: statsDtoFromJson computes derived fields', () => {
	it('computes approvalBps and participatingPoints from raw Firestore data', () => {
		// This is the actual structure written by the trusted service
		const rawFirestoreStats = {
			ayePoints: 60,
			nayPoints: 40,
			abstainPoints: 10,
			ayeVoters: 1,
			nayVoters: 1,
			abstainVoters: 1,
			totalVoters: 3,
			updatedAt: TEST_ISO_DATE,
			schemaVersion: 1
		};

		const dto = statsDtoFromJson(rawFirestoreStats);

		expect(dto).not.toBeNull();
		expect(dto!.ayePoints).toBe(60);
		expect(dto!.nayPoints).toBe(40);
		expect(dto!.abstainPoints).toBe(10);
		expect(dto!.ayeVoters).toBe(1);
		expect(dto!.nayVoters).toBe(1);
		expect(dto!.abstainVoters).toBe(1);
		expect(dto!.totalVoters).toBe(3);
		// Derived fields must be computed correctly
		expect(dto!.approvalBps).toBe(6000); // 60 / (60 + 40) * 10000 = 6000
		expect(dto!.participatingPoints).toBe(110); // 60 + 40 + 10 = 110
		expect(dto!.updatedAt).toBe(TEST_ISO_DATE);
	});

	it('handles zero denominator (all abstain) correctly', () => {
		const rawStats = {
			ayePoints: 0,
			nayPoints: 0,
			abstainPoints: 50,
			ayeVoters: 0,
			nayVoters: 0,
			abstainVoters: 2,
			totalVoters: 2,
			updatedAt: TEST_ISO_DATE,
			schemaVersion: 1
		};

		const dto = statsDtoFromJson(rawStats);

		expect(dto).not.toBeNull();
		expect(dto!.approvalBps).toBe(0); // Zero denominator returns 0
		expect(dto!.participatingPoints).toBe(50);
	});

	it('handles empty stats correctly', () => {
		const rawStats = {
			ayePoints: 0,
			nayPoints: 0,
			abstainPoints: 0,
			ayeVoters: 0,
			nayVoters: 0,
			abstainVoters: 0,
			totalVoters: 0,
			updatedAt: TEST_ISO_DATE,
			schemaVersion: 1
		};

		const dto = statsDtoFromJson(rawStats);

		expect(dto).not.toBeNull();
		expect(dto!.approvalBps).toBe(0);
		expect(dto!.participatingPoints).toBe(0);
	});

	it('returns null for malformed data', () => {
		expect(statsDtoFromJson(null)).toBeNull();
		expect(statsDtoFromJson({})).toBeNull();
		expect(statsDtoFromJson({ ayePoints: 'not-a-number' })).toBeNull();
		expect(statsDtoFromJson({ ayePoints: -1, nayPoints: 0, abstainPoints: 0, ayeVoters: 0, nayVoters: 0, abstainVoters: 0, totalVoters: 0, updatedAt: TEST_ISO_DATE })).toBeNull();
	});
});

describe('F01: statsDtoFromSnapshotData handles Firestore Timestamp', () => {
	it('converts Firestore Timestamp to ISO string and computes derived fields', () => {
		const mockTimestamp = {
			toDate: () => new Date(TEST_ISO_DATE)
		};

		const snapshotData = {
			ayePoints: 60,
			nayPoints: 40,
			abstainPoints: 10,
			ayeVoters: 1,
			nayVoters: 1,
			abstainVoters: 1,
			totalVoters: 3,
			updatedAt: mockTimestamp,
			schemaVersion: 1
		};

		const dto = statsDtoFromSnapshotData(snapshotData);

		expect(dto).not.toBeNull();
		expect(dto!.approvalBps).toBe(6000);
		expect(dto!.participatingPoints).toBe(110);
		expect(dto!.updatedAt).toBe(TEST_ISO_DATE);
	});

	it('handles missing Timestamp gracefully', () => {
		const snapshotData = {
			ayePoints: 10,
			nayPoints: 10,
			abstainPoints: 0,
			ayeVoters: 1,
			nayVoters: 1,
			abstainVoters: 0,
			totalVoters: 2,
			// No updatedAt field
			schemaVersion: 1
		};

		const dto = statsDtoFromSnapshotData(snapshotData);

		// Should still compute derived fields even with missing timestamp
		expect(dto).not.toBeNull();
		expect(dto!.approvalBps).toBe(5000);
		expect(dto!.participatingPoints).toBe(20);
	});
});
