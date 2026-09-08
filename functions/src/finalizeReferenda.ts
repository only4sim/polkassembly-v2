// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Scheduled wrapper for the Referenda lifecycle processor.
 *
 * This file intentionally contains ONLY scheduling, db/time wiring and logging.
 * All transition rules live in `./lifecycle.ts` (`processReferendaLifecycle`),
 * which is exported for direct invocation from emulator tests with an injected
 * clock — no Pub/Sub emulator or scheduler trigger is needed to test them.
 */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { processReferendaLifecycle } from './lifecycle';

export const finalizeReferenda = onSchedule(
	{
		schedule: 'every 5 minutes',
		timeZone: 'UTC',
		retryCount: 3,
		timeoutSeconds: 300
	},
	async () => {
		const db = admin.firestore();
		const now = new Date();
		try {
			const result = await processReferendaLifecycle(db, now);
			if (result.opened > 0 || result.rejectedExpired > 0 || result.finalized > 0 || result.failed > 0) {
				logger.info('finalizeReferenda: lifecycle pass complete', { ...result });
			}
			if (result.failed > 0) {
				// Per-document failures were logged and are retried on the next pass
				// (documents remain in their pre-transition state). Not fatal here.
				logger.warn('finalizeReferenda: some documents failed and will be retried', { failed: result.failed });
			}
		} catch (error) {
			// Frozen contract (PR-4): unexpected errors are re-thrown so the
			// scheduler retries the whole run.
			logger.error('finalizeReferenda: lifecycle run failed', error);
			throw error;
		}
	}
);
