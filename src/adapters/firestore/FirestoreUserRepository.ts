// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import * as admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACC_CONFIG } from '@/app/api/_api-constants/apiEnvVars';
import { User } from '@/domain/entities/User';
import { UserRepository } from '@/ports/repositories/UserRepository';

// Reuse the same firebase-admin initialization pattern as demoAuthService.ts
if (FIREBASE_SERVICE_ACC_CONFIG && !admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACC_CONFIG))
	});
} else if (process.env.NODE_ENV === 'development' && !admin.apps.length) {
	if (!process.env.FIRESTORE_EMULATOR_HOST) {
		process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
	}
	if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
		process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
	}
	const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project';
	admin.initializeApp({ projectId });
}

/**
 * Firestore implementation of UserRepository
 *
 * This adapter provides concrete implementation for user persistence using Firebase Firestore.
 * It translates domain operations to Firestore queries and handles data serialization.
 *
 * TODO: Add error handling and validation
 * TODO: Add logging and monitoring
 */
export class FirestoreUserRepository implements UserRepository {
	private db = admin.firestore();

	private collection = this.db.collection('users');

	/**
	 * Retrieve a user by UID
	 *
	 * - Collection: users
	 * - Document path: users/{uid}
	 * - Convert Firestore Timestamp to Date
	 * - Map Firestore document to User entity
	 */
	async getUserByUid(uid: string): Promise<User | null> {
		const doc = await this.collection.doc(uid).get();
		if (!doc.exists) return null;
		const data = doc.data()!;
		return {
			uid: data.uid,
			email: data.email,
			displayName: data.displayName,
			role: data.role,
			pointsBalance: data.pointsBalance ?? 0,
			createdAt: data.createdAt?.toDate() ?? new Date(),
			updatedAt: data.updatedAt?.toDate() ?? new Date()
		};
	}

	/**
	 * Create a new user profile
	 *
	 * - Generate timestamps (createdAt, updatedAt)
	 * - Create document in Firestore at users/{uid}
	 * - Return created user entity
	 */
	async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
		const now = new Date();
		const newUser: User = { ...user, createdAt: now, updatedAt: now };
		await this.collection.doc(user.uid).set({
			...newUser,
			createdAt: admin.firestore.Timestamp.fromDate(now),
			updatedAt: admin.firestore.Timestamp.fromDate(now)
		});
		return newUser;
	}

	/**
	 * Update an existing user profile
	 *
	 * - Set updatedAt timestamp
	 * - Use Firestore update() with merge
	 */
	async updateUser(uid: string, updates: Partial<Omit<User, 'uid' | 'createdAt'>>): Promise<void> {
		await this.collection.doc(uid).update({
			...updates,
			updatedAt: admin.firestore.Timestamp.fromDate(new Date())
		});
	}

	/**
	 * Set the role of a user
	 *
	 * - Update role field and updatedAt timestamp
	 */
	async setRole(uid: string, role: 'user' | 'admin'): Promise<void> {
		await this.collection.doc(uid).update({
			role,
			updatedAt: admin.firestore.Timestamp.fromDate(new Date())
		});
	}

	/**
	 * Get the points balance for a user
	 *
	 * - Fetch user document and return pointsBalance field
	 */
	async getPointsBalance(uid: string): Promise<number> {
		const doc = await this.collection.doc(uid).get();
		return doc.data()?.pointsBalance ?? 0;
	}
}
