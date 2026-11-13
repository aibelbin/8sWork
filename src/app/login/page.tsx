import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthForm, type AuthMode } from './auth-form';

const HEADINGS: Record<AuthMode, string> = {
  signin: 'Sign in to keep track of your applications.',
  signup: 'Create an account.',
  forgot: 'Reset your password.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string }> }) {
  const { mode: rawMode, error } = await searchParams;
  const mode: AuthMode = rawMode === 'signup' || rawMode === 'forgot' ? rawMode : 'signin';
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
          <p className="text-muted-foreground">{HEADINGS[mode]}</p>
        </div>
        {error === 'link' && (
          <p role="alert" className="text-sm text-destructive">
            That link is invalid or has expired. Please try again.
          </p>
        )}
        <AuthForm key={mode} mode={mode} />
        <div className="flex justify-center gap-4 text-sm">
          {mode !== 'signin' && <Link href="/login" className="underline">Sign in</Link>}
          {mode !== 'signup' && <Link href="/login?mode=signup" className="underline">Create an account</Link>}
          {mode === 'signin' && <Link href="/login?mode=forgot" className="underline">Forgot password?</Link>}
        </div>
      </div>
    </main>
  );
}
