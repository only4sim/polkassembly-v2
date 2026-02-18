// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { redirect } from 'next/navigation';
import VotingHistoryClient from './VotingHistoryClient';

export default function VotingHistoryPage() {
	if (process.env.ENABLE_BLOCKCHAIN !== 'true') {
		redirect('/');
	}
	return <VotingHistoryClient />;
}
