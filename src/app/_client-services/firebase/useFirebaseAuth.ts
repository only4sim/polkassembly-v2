// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { useCallback, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onIdTokenChanged, signInWithEmailAndPassword, signOut, updateProfile, User } from 'firebase/auth';
import { clientAuth } from './firebaseClientApp';

export interface IDemoUser {
	uid: string;
	email: string | null;
	displayName: string | null;
}

export function useFirebaseAuth() {
	const [user, setUser] = useState<IDemoUser | null>(null);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		// Use onIdTokenChanged instead of onAuthStateChanged so that all hook instances
		// receive the updated user (including displayName) when the token is force-refreshed
		// after updateProfile() in register(). onAuthStateChanged does not fire on token
		// refreshes, so the Navbar and other components would miss the displayName update.
		const unsubscribe = onIdTokenChanged(clientAuth, (firebaseUser: User | null) => {
			if (firebaseUser) {
				setUser({
					uid: firebaseUser.uid,
					email: firebaseUser.email,
					displayName: firebaseUser.displayName
				});
			} else {
				setUser(null);
			}
			setLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const register = useCallback(async (email: string, password: string, displayName?: string) => {
		const userCredential = await createUserWithEmailAndPassword(clientAuth, email, password);
		if (displayName) {
			await updateProfile(userCredential.user, { displayName });
			// Force-refresh the ID token so the next API call includes `name` in the claims.
			// Without this, the cached token (issued before updateProfile) would be missing
			// displayName, and the server's lazy Firestore doc creation would use email instead.
			await userCredential.user.getIdToken(true);
			setUser({
				uid: userCredential.user.uid,
				email: userCredential.user.email,
				displayName
			});
		}
		return userCredential.user;
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		const userCredential = await signInWithEmailAndPassword(clientAuth, email, password);
		return userCredential.user;
	}, []);

	const logout = useCallback(async () => {
		await signOut(clientAuth);
		setUser(null);
	}, []);

	const getIdToken = useCallback(async (): Promise<string | null> => {
		const { currentUser } = clientAuth;
		if (!currentUser) return null;
		return currentUser.getIdToken();
	}, []);

	return { user, loading, register, login, logout, getIdToken };
}
