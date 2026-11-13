'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function GoogleButton() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setPending(false);
      toast.error(error.message);
    }
  }

  return (
    <Button className="w-full" onClick={signIn} disabled={pending}>
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  );
}
