'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { sendPasswordReset, signIn, signUp } from '@/app/actions/auth';
import { Field } from '@/components/form-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type AuthMode = 'signin' | 'signup' | 'forgot';

const ACTIONS = { signin: signIn, signup: signUp, forgot: sendPasswordReset };
const SUBMIT = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link' };

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [state, formAction, pending] = useActionState(ACTIONS[mode], undefined);

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <p role="status">{state.message}</p>
        <Link href="/login" className="text-sm underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 text-left">
      <Field label="Email" htmlFor="email" errors={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      {mode !== 'forgot' && (
        <Field label="Password" htmlFor="password" errors={state?.errors?.password}>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === 'signup' ? 8 : undefined}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </Field>
      )}
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Please wait…' : SUBMIT[mode]}
      </Button>
    </form>
  );
}
