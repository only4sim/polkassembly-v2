// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-key',
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'localhost',
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const clientAuth = getAuth(app);
export const clientDb = getFirestore(app);
export const clientFunctions = getFunctions(app);

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
	connectAuthEmulator(clientAuth, 'http://localhost:9099', { disableWarnings: true });
	connectFirestoreEmulator(clientDb, 'localhost', 8080);
	connectFunctionsEmulator(clientFunctions, 'localhost', 5001);
}
