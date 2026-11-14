import Link from 'next/link';
import { Suspense } from 'react';
import { NativeSelect } from '@/components/form-controls';
import { PageLoading } from '@/components/page-loading';
import { RemovePostingButton, TrackButton } from '@/components/posting-buttons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate, istDate } from '@/lib/dates';
import { JOB_TYPES, label, type Posting } from '@/lib/domain';
import { requireUser } from '@/lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function JobsContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const q = get('q');
  const type = get('type');

  const { supabase, user } = await requireUser();
  const today = istDate();
  let query = supabase
    .from('postings')
    .select('*')
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order('created_at', { ascending: false });
  if ((JOB_TYPES as readonly string[]).includes(type)) query = query.eq('job_type', type);
  const [{ data, error }, { data: tracked }] = await Promise.all([
    query,
    supabase.from('applications').select('id, posting_id').not('posting_id', 'is', null),
  ]);
  if (error) throw new Error(error.message);

  const trackedBy = new Map((tracked ?? []).map((a) => [a.posting_id as string, a.id as string]));
  // Search runs in JS so user text never goes into a PostgREST filter string.
  const needle = q.trim().toLowerCase();
  const postings = (data as Posting[]).filter(
    (p) => !needle || p.company.toLowerCase().includes(needle) || p.role.toLowerCase().includes(needle),
  );

  return (
    <>
      <form role="search" className="flex flex-wrap gap-2">
        <Input name="q" aria-label="Search" placeholder="Search company or role" defaultValue={q} className="w-full sm:w-56" />
        <NativeSelect name="type" aria-label="Filter by job type" options={JOB_TYPES} placeholder="All job types" defaultValue={type} className="w-auto" />
        <Button type="submit" variant="outline">Apply</Button>
      </form>

      {postings.length === 0 ? (
        <p className="text-muted-foreground">
          No jobs shared yet. <Link href="/jobs/new" className="underline">Share a job</Link>
        </p>
      ) : (
        <ul className="grid gap-3">
          {postings.map((p) => {
            const appId = trackedBy.get(p.id);
            const mine = p.created_by === user.id;
            const facts = [p.salary, p.location, p.job_type && label(p.job_type), p.deadline && `Apply by ${formatDate(p.deadline)}`].filter(Boolean);
            return (
              <li key={p.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.company}</p>
                    <p className="text-sm text-muted-foreground">{p.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {appId ? (
                      <Link href={`/applications/${appId}`}><Badge variant="secondary">Tracking</Badge></Link>
                    ) : (
                      !mine && <TrackButton id={p.id} />
                    )}
                    {mine && <RemovePostingButton id={p.id} />}
                  </div>
                </div>
                {facts.length > 0 && <p className="text-sm">{facts.join(' · ')}</p>}
                <p className="flex flex-wrap gap-3 text-sm">
                  <span className="text-muted-foreground">Apply via {label(p.apply_method).toLowerCase()}</span>
                  {p.job_url && <a href={p.job_url} target="_blank" rel="noreferrer" className="underline">Open posting</a>}
                  {p.contact_email && <a href={`mailto:${p.contact_email}`} className="underline">{p.contact_email}</a>}
                </p>
                {p.details && <p className="text-sm whitespace-pre-line text-muted-foreground">{p.details}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Find jobs</h1>
        <Link href="/jobs/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Share a job</Link>
      </div>
      <Suspense fallback={<PageLoading />}>
        <JobsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
