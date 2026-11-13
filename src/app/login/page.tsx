import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GoogleButton } from './google-button';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/');

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Job Tracker</h1>
          <p className="text-muted-foreground">Every application, round and follow-up in one place.</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Sign-in failed. Please try again.
          </p>
        )}
        <GoogleButton />
      </div>
    </main>
  );
}
