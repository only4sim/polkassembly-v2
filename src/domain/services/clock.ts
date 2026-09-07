// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

/**
 * Injectable clock used so time-dependent logic and tests never depend on the
 * real current time. Frozen contract (PR-1): domain functions already accept
 * explicit `now` parameters; this abstraction is the shared seam for services
 * and tests that need deterministic time.
 */
export interface Clock {
	now(): Date;
}

/** Production clock. */
export const systemClock: Clock = {
	now: () => new Date()
};

/**
 * Clock pinned to a fixed instant. Each call returns a fresh Date with the same
 * time, so callers cannot mutate shared state.
 */
export function frozenClock(fixed: Date): Clock {
	const fixedMs = fixed.getTime();
	return {
		now: () => new Date(fixedMs)
	};
}

/**
 * Clock advancing by a fixed offset from a base instant on every call — useful
 * for asserting "later reads observe a moved clock" without jest fake timers.
 */
export function offsetClock(base: Date, offsetMs: number): Clock {
	let calls = 0;
	return {
		now: () => {
			const value = new Date(base.getTime() + offsetMs * calls);
			calls += 1;
			return value;
		}
	};
}
