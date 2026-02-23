// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { getNetworkFromHeaders } from '@/app/api/_api-utils/getNetworkFromHeaders';
import { NextResponse } from 'next/server';
import { RedisService } from '@/app/api/_api-services/redis_service';
import { OnChainDbService } from '@/app/api/_api-services/onchain_db_service';
import { withErrorHandling } from '../../../_api-utils/withErrorHandling';
import { ENABLE_BLOCKCHAIN } from '@/app/api/_api-constants/apiEnvVars';

export const GET = withErrorHandling(async () => {
	const network = await getNetworkFromHeaders();

	if (!ENABLE_BLOCKCHAIN) return NextResponse.json({});

	const cachedStats = await RedisService.GetDelegationStats(network);
	if (cachedStats) {
		return NextResponse.json(cachedStats);
	}

	const stats = await OnChainDbService.GetConvictionVotingDelegationStats(network);

	await RedisService.SetDelegationStats(network, stats);

	return NextResponse.json(stats);
});
