// Copyright 2019-2025 @polkassembly/polkassembly authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

'use client';

import React, { useState } from 'react';
import { Button } from '@/app/_shared-components/Button';
import { Input } from '@ui/Input';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@ui/Form';
import { PasswordInput } from '@ui/PasswordInput/PasswordInput';
import ErrorMessage from '@ui/ErrorMessage';
import { useRouter } from 'nextjs-toploader/app';
import { useDemoUser } from '@/hooks/useDemoUser';
import DemoAuthRegister from './DemoAuthRegister';

interface IFormFields {
	email: string;
	password: string;
}

function DemoAuthLogin() {
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [showRegister, setShowRegister] = useState(false);

	const { login } = useDemoUser();
	const router = useRouter();

	const form = useForm<IFormFields>();

	const handleLogin = async (values: IFormFields) => {
		const { email, password } = values;

		if (!email || !password) {
			setErrorMessage('Please enter your email and password.');
			return;
		}

		try {
			setLoading(true);
			setErrorMessage('');
			await login(email, password);
			router.replace('/');
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
			setErrorMessage(message);
		} finally {
			setLoading(false);
		}
	};

	if (showRegister) {
		return <DemoAuthRegister switchToLogin={() => setShowRegister(false)} />;
	}

	return (
		<div>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(handleLogin)}>
					<div className='flex flex-col gap-4 p-4'>
						<FormField
							control={form.control}
							name='email'
							key='email'
							disabled={loading}
							rules={{ required: 'Email is required' }}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input
											placeholder='Enter your email'
											type='email'
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='password'
							key='password'
							disabled={loading}
							rules={{ required: 'Password is required' }}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<FormControl>
										<PasswordInput
											placeholder='Enter your password'
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					{errorMessage && <ErrorMessage errorMessage={errorMessage} />}
					<div className='flex flex-col items-center gap-4 p-4'>
						<Button
							isLoading={loading}
							type='submit'
							className='w-full'
							size='lg'
						>
							Login
						</Button>
						<p className='text-sm text-text_primary'>
							Don&apos;t have an account?{' '}
							<Button
								onClick={() => setShowRegister(true)}
								variant='ghost'
								className='p-0 text-text_pink'
								disabled={loading}
								type='button'
							>
								Sign Up
							</Button>
						</p>
					</div>
				</form>
			</Form>
		</div>
	);
}

export default DemoAuthLogin;
