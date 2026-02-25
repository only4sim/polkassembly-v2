// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/* eslint-disable class-methods-use-this */

import { User } from '@/domain/entities/User';
import { UserRepository } from '@/ports/repositories/UserRepository';

/**
 * Firestore implementation of UserRepository
 *
 * This adapter provides concrete implementation for user persistence using Firebase Firestore.
 * It translates domain operations to Firestore queries and handles data serialization.
 *
 * TODO: Implement all methods with actual Firestore logic
 * TODO: Add error handling and validation
 * TODO: Add logging and monitoring
 */
export class FirestoreUserRepository implements UserRepository {
	/**
	 * TODO: Initialize Firestore connection
	 * - Import firebase-admin
	 * - Get Firestore instance
	 * - Set up collection reference: firestore.collection('users')
	 */

	/**
	 * Retrieve a user by UID
	 *
	 * TODO: Implement Firestore query
	 * - Collection: users
	 * - Document path: users/{uid}
	 * - Convert Firestore Timestamp to Date
	 * - Map Firestore document to User entity
	 */
	async getUserByUid(_uid: string): Promise<User | null> {
		// TODO: Implement
		// Example: const doc = await firestore.collection('users').doc(uid).get();
		// if (!doc.exists) return null;
		// return mapFirestoreDocToUser(doc.data());
		throw new Error('Not implemented: getUserByUid');
	}

	/**
	 * Create a new user profile
	 *
	 * TODO: Implement user creation
	 * - Generate timestamps (createdAt, updatedAt)
	 * - Create document in Firestore at users/{uid}
	 * - Return created user entity
	 */
	async createUser(_user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
		// TODO: Implement
		// 1. Set createdAt = updatedAt = new Date()
		// 2. Create document: firestore.collection('users').doc(user.uid).set(...)
		// 3. Return User entity
		throw new Error('Not implemented: createUser');
	}

	/**
	 * Update an existing user profile
	 *
	 * TODO: Implement user update
	 * - Set updatedAt timestamp
	 * - Use Firestore update() with merge
	 */
	async updateUser(_uid: string, _updates: Partial<Omit<User, 'uid' | 'createdAt'>>): Promise<void> {
		// TODO: Implement
		// 1. Add updatedAt timestamp to updates
		// 2. firestore.collection('users').doc(uid).update({ ...updates, updatedAt: new Date() })
		throw new Error('Not implemented: updateUser');
	}
}
