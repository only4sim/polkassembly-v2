// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
export async function generateMetadata(_params: { params: Promise<{ index: string }> }): Promise<Metadata> {
	if (process.env.ENABLE_BLOCKCHAIN !== 'true') {
		return { title: 'Referendum – DemoOS' };
	}
	// Chain mode: load rich metadata from the chain detail component
	const chainModule = await import('./ReferendaChainDetail');
	if (typeof chainModule.generateMetadata === 'function') {
		return chainModule.generateMetadata(_params);
	}
	return { title: 'Referendum' };
}

export default async function ReferendaDetailProvider({ params, searchParams }: { params: Promise<{ index: string }>; searchParams: Promise<{ created?: string }> }) {
	if (process.env.ENABLE_BLOCKCHAIN === 'true') {
		const { default: ChainDetail } = await import('./ReferendaChainDetail');
		return (
			<ChainDetail
				params={params}
				searchParams={searchParams}
			/>
		);
	}

	const { default: DemoReferendaDetail } = await import('./DemoReferendaDetail');
	return <DemoReferendaDetail params={params} />;
}
