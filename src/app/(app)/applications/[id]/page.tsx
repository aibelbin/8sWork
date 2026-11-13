import { Suspense } from 'react';
import { PageLoading } from '@/components/page-loading';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ApplicationForm } from '@/components/application-form';
import { DeleteApplicationButton } from '@/components/delete-application-button';
import { RoundList } from '@/components/round-list';
import { istDate } from '@/lib/dates';
import type { Application, Round } from '@/lib/domain';
import { requireUser } from '@/lib/supabase/server';

async function ApplicationPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from('applications').select('*, rounds(*)').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const app = data as Application & { rounds: Round[] };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{app.company}</h1>
          <p className="text-muted-foreground">{app.role}</p>
        </div>
        {app.job_url && (
          <a href={app.job_url} target="_blank" rel="noreferrer" className="text-sm underline">
            Open posting
          </a>
        )}
      </div>
      <ApplicationForm application={app} today={istDate()} />
      <RoundList applicationId={app.id} rounds={app.rounds} />
      <DeleteApplicationButton id={app.id} />
    </div>
  );
}

// Per-user data streams in behind the fallback (Cache Components needs the data access inside <Suspense>).
export default function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ApplicationPageContent params={params} />
    </Suspense>
  );
}
