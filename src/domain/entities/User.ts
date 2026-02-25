// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

export interface User {
	uid: string;
	email: string;
	displayName: string;
	role: 'user' | 'admin';
	pointsBalance: number;
	createdAt: Date;
	updatedAt: Date;
}
