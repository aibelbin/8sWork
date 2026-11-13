'use client';

import { useActionState } from 'react';
import { updatePassword } from '@/app/actions/auth';
import { Field } from '@/components/form-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ResetForm() {
  const [state, formAction, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={formAction} className="grid gap-4 text-left">
      <Field label="New password" htmlFor="password" errors={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" errors={state?.errors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
