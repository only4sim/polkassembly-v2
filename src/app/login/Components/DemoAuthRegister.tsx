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

interface IFormFields {
	email: string;
	password: string;
	confirmPassword: string;
}

function DemoAuthRegister({ switchToLogin }: { switchToLogin: () => void }) {
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');

	const { register } = useDemoUser();
	const router = useRouter();

	const form = useForm<IFormFields>();

	const handleRegister = async (values: IFormFields) => {
		const { email, password, confirmPassword } = values;

		if (!email || !password) {
			setErrorMessage('Please enter your email and password.');
			return;
		}

		if (password !== confirmPassword) {
			setErrorMessage('Passwords do not match.');
			return;
		}

		try {
			setLoading(true);
			setErrorMessage('');
			await register(email, password);
			router.replace('/');
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
			setErrorMessage(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(handleRegister)}>
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
						<FormField
							control={form.control}
							name='confirmPassword'
							key='confirmPassword'
							disabled={loading}
							rules={{
								required: 'Please confirm your password',
								validate: (value, allFields) => {
									if (value !== allFields.password) return 'Passwords do not match';
									return true;
								}
							}}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Confirm Password</FormLabel>
									<FormControl>
										<PasswordInput
											placeholder='Re-enter your password'
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
							Sign Up
						</Button>
						<p className='text-sm text-text_primary'>
							Already have an account?{' '}
							<Button
								onClick={switchToLogin}
								variant='ghost'
								className='p-0 text-text_pink'
								disabled={loading}
								type='button'
							>
								Login
							</Button>
						</p>
					</div>
				</form>
			</Form>
		</div>
	);
}

export default DemoAuthRegister;
