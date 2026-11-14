'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { FormState } from '@/lib/form-state';
import { signInSchema, signUpSchema } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';

// Never echo passwords back to the browser; only the email is kept for redisplay.
const keepEmail = (formData: FormData) => ({ email: String(formData.get('email') ?? '') });

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepEmail(formData);
  const result = signInSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: z.flattenError(result.error).fieldErrors, values };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) return { message: 'Wrong email or password.', values };
  redirect('/');
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepEmail(formData);
  const result = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: z.flattenError(result.error).fieldErrors, values };
  const supabase = await createClient();
  // Email confirmation is off in Supabase Auth, so sign-up returns a session straight away.
  const { data, error } = await supabase.auth.signUp(result.data);
  if (error) return { message: error.message, values };
  if (!data.session) return { message: 'Account created, but sign-in failed. Try signing in.', values };
  redirect('/');
}

