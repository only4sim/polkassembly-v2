// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

// TODO: Once Posts CRUD (Issue #6) is merged, query Firestore `posts` where
// `authorUid === uid` and display as a list. Until then, show placeholder.

interface DemoProfilePostsProps {
	uid: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
function DemoProfilePosts({ uid }: DemoProfilePostsProps) {
	return (
		<div className='flex flex-col items-center justify-center py-12 text-wallet_btn_text'>
			<p>No posts yet.</p>
		</div>
	);
}

export default DemoProfilePosts;
