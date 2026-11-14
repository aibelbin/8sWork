'use client';

import { useActionState } from 'react';
import { signIn, signUp } from '@/app/actions/auth';
import { Field } from '@/components/form-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type AuthMode = 'signin' | 'signup';

const ACTIONS = { signin: signIn, signup: signUp };
const SUBMIT = { signin: 'Sign in', signup: 'Create account' };

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [state, formAction, pending] = useActionState(ACTIONS[mode], undefined);

  return (
    <form action={formAction} className="grid gap-4 text-left">
      <Field label="Email" htmlFor="email" errors={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
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
