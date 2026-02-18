// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { redirect } from 'next/navigation';
import SetIdentityModalClient from './SetIdentityModalClient';

export default function SetIdentityModalPage() {
	if (process.env.ENABLE_BLOCKCHAIN !== 'true') {
		redirect('/');
	}
	return <SetIdentityModalClient />;
}
