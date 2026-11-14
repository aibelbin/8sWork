import { Suspense } from 'react';
import { PageLoading } from '@/components/page-loading';
import { PostingForm } from '@/components/posting-form';
import { requireUser } from '@/lib/supabase/server';

async function ShareJobForm() {
  await requireUser();
  return <PostingForm />;
}

export default function ShareJobPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Share a job</h1>
        <p className="text-sm text-muted-foreground">
          Posts it to Find jobs for everyone. Nothing is added to your applications, and your name isn&apos;t shown.
        </p>
      </div>
      <Suspense fallback={<PageLoading />}>
        <ShareJobForm />
      </Suspense>
    </div>
  );
}
