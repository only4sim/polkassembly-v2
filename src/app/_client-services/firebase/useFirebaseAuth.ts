// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { useCallback, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
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
		const unsubscribe = onAuthStateChanged(clientAuth, (firebaseUser: User | null) => {
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

	const register = useCallback(async (email: string, password: string) => {
		const userCredential = await createUserWithEmailAndPassword(clientAuth, email, password);
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
