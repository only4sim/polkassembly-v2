// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { User } from '@/domain/entities/User';

/**
 * Repository interface for User data access
 *
 * This port defines the contract for user persistence operations.
 * Implementations (adapters) can use Firestore, PostgreSQL, or any other data store.
 */
export interface UserRepository {
	/**
	 * Retrieve a user by their UID
	 * @param uid - Firebase Auth UID
	 * @returns User if found, null otherwise
	 */
	getUserByUid(uid: string): Promise<User | null>;

	/**
	 * Create a new user profile
	 * @param user - User data without timestamps (auto-generated)
	 * @returns Created user with generated timestamps
	 */
	createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;

	/**
	 * Update an existing user profile
	 * @param uid - Firebase Auth UID
	 * @param updates - Partial user data to update
	 */
	updateUser(uid: string, updates: Partial<Omit<User, 'uid' | 'createdAt'>>): Promise<void>;
}
