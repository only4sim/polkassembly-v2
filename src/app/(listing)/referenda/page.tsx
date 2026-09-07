// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
	if (process.env.ENABLE_BLOCKCHAIN !== 'true') {
		return { title: 'Referenda – DemoOS' };
	}
	// Chain mode: load rich metadata with network URL from the chain page component
	const chainModule = await import('./ReferendaChainPage');
	if (typeof chainModule.generateMetadata === 'function') {
		return chainModule.generateMetadata();
	}
	return { title: 'Referenda' };
}

export default async function ReferendaPageProvider({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
	if (process.env.ENABLE_BLOCKCHAIN === 'true') {
		const { default: ChainPage } = await import('./ReferendaChainPage');
		return <ChainPage searchParams={searchParams} />;
	}

	const { default: DemoReferendaPage } = await import('./DemoReferendaPage');
	return <DemoReferendaPage />;
}
