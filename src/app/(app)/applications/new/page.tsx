import { Suspense } from 'react';
import { ApplicationForm } from '@/components/application-form';
import { PageLoading } from '@/components/page-loading';
import { istDate } from '@/lib/dates';
import { requireUser } from '@/lib/supabase/server';

async function NewApplicationForm() {
  await requireUser(); // request-time, so "today" is the real date
  return <ApplicationForm today={istDate()} />;
}

export default function NewApplicationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New application</h1>
      <Suspense fallback={<PageLoading />}>
        <NewApplicationForm />
      </Suspense>
    </div>
  );
}
