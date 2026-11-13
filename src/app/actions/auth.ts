'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { FormState } from '@/lib/form-state';
import { emailOnlySchema, newPasswordSchema, signInSchema, signUpSchema } from '@/lib/schemas';
import { createClient, requireUser } from '@/lib/supabase/server';

// Email links land here; the Supabase email templates append the token hash.
const confirmUrl = () => `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`;

// Never echo passwords back to the browser; only the email is kept for redisplay.
const keepEmail = (formData: FormData) => ({ email: String(formData.get('email') ?? '') });

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepEmail(formData);
  const result = signInSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: z.flattenError(result.error).fieldErrors, values };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) {
    const message =
      error.code === 'email_not_confirmed'
        ? 'Confirm your email first. The link is in your inbox.'
        : 'Wrong email or password.';
    return { message, values };
  }
  redirect('/');
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepEmail(formData);
  const result = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: z.flattenError(result.error).fieldErrors, values };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ ...result.data, options: { emailRedirectTo: confirmUrl() } });
  if (error) return { message: error.message, values };
  return { ok: true, message: `Check ${result.data.email} for a link to confirm your account.` };
}

export async function sendPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepEmail(formData);
  const result = emailOnlySchema.safeParse(values);
  if (!result.success) return { errors: z.flattenError(result.error).fieldErrors, values };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, { redirectTo: confirmUrl() });
  if (error) return { message: error.message, values };
  // Same reply whether or not the account exists, so this form can't be used to probe for accounts.
  return { ok: true, message: 'If that email has an account, a reset link is on its way.' };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const result = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: z.flattenError(result.error).fieldErrors };
  const { error } = await supabase.auth.updateUser({ password: result.data.password });
  if (error) return { message: error.message };
  redirect('/');
}
