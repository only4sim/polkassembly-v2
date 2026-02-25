// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { ERROR_CODES, ERROR_MESSAGES } from '@/_shared/_constants/errorLiterals';
import { AuthService } from '@/app/api/_api-services/auth_service';
import { OffChainDbService } from '@/app/api/_api-services/offchain_db_service';
import { APIError } from '@/app/api/_api-utils/apiError';
import { withErrorHandling } from '@/app/api/_api-utils/withErrorHandling';
import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';

export const GET = withErrorHandling(async (): Promise<NextResponse> => {
	const { newAccessToken, newRefreshToken } = await AuthService.ValidateAuthAndRefreshTokens();

	const loggedInUserId = AuthService.GetUserIdFromAccessToken(newAccessToken);

	const user = await OffChainDbService.GetPublicUserById(loggedInUserId);

	if (!user) {
		throw new APIError(ERROR_CODES.NOT_FOUND, StatusCodes.NOT_FOUND, ERROR_MESSAGES.NOT_FOUND);
	}

	const response = NextResponse.json(user);
	response.headers.append('Set-Cookie', await AuthService.GetAccessTokenCookie(newAccessToken));
	response.headers.append('Set-Cookie', await AuthService.GetRefreshTokenCookie(newRefreshToken));

	return response;
});
