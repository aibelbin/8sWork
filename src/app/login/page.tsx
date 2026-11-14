import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthForm, type AuthMode } from './auth-form';

const HEADINGS: Record<AuthMode, string> = {
  signin: 'Sign in to keep track of your applications.',
  signup: 'Create an account.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode: AuthMode = (await searchParams).mode === 'signup' ? 'signup' : 'signin';
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
        <AuthForm key={mode} mode={mode} />
        <div className="flex justify-center gap-4 text-sm">
          {mode === 'signup' ? (
            <Link href="/login" className="underline">Sign in</Link>
          ) : (
            <Link href="/login?mode=signup" className="underline">Create an account</Link>
          )}
        </div>
      </div>
    </main>
  );
}
