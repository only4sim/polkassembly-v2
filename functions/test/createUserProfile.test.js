// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.
// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.
const test = require('node:test');
const assert = require('node:assert/strict');

const { INITIAL_USER_POINTS_BALANCE } = require('../lib/constants.js');
const { createUserProfileDocument } = require('../lib/utils/createUserProfile.js');

test('new users start with 1000 points', () => {
	assert.equal(INITIAL_USER_POINTS_BALANCE, 1000);

	const profile = createUserProfileDocument({
		uid: 'uid-123',
		email: 'new.user@example.com',
		displayName: ''
	});

	assert.equal(profile.uid, 'uid-123');
	assert.equal(profile.email, 'new.user@example.com');
	assert.equal(profile.displayName, 'new.user');
	assert.equal(profile.role, 'user');
	assert.equal(profile.pointsBalance, 1000);
	assert.ok(profile.createdAt);
	assert.ok(profile.updatedAt);
});
