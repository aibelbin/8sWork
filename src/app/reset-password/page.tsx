import { requireUser } from '@/lib/supabase/server';
import { ResetForm } from './reset-form';

export default async function ResetPasswordPage() {
  await requireUser();
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
          <p className="text-muted-foreground">At least 8 characters.</p>
        </div>
        <ResetForm />
      </div>
    </main>
  );
}
