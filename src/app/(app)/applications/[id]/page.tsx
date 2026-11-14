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

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ share?: string }> };

async function ApplicationPageContent({ params, searchParams }: Props) {
  const [{ id }, { share: shareParam }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('applications')
    .select('*, rounds(*), posting:postings(created_by)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const app = data as Application & { rounds: Round[]; posting: { created_by: string | null } | null };
  const share = app.posting ? (app.posting.created_by === user.id ? 'own' : 'tracked') : undefined;

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
      {shareParam === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          Saved, but sharing failed. Tick &quot;Share this job&quot; and save again.
        </p>
      )}
      <ApplicationForm application={app} today={istDate()} share={share} />
      <RoundList applicationId={app.id} rounds={app.rounds} />
      <DeleteApplicationButton id={app.id} />
    </div>
  );
}

// Per-user data streams in behind the fallback (Cache Components needs the data access inside <Suspense>).
export default function ApplicationPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ApplicationPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
