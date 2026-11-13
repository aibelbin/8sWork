import { Suspense } from 'react';
import { PageLoading } from '@/components/page-loading';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TodayItem } from '@/components/today-item';
import { formatDate, formatDateTime, istDate } from '@/lib/dates';
import type { Application, Round } from '@/lib/domain';
import { collectDue, isEmpty, TODAY_WINDOWS } from '@/lib/due';
import { requireUser } from '@/lib/supabase/server';

async function TodayPageContent() {
  const { supabase } = await requireUser();
  const [apps, rounds] = await Promise.all([
    supabase.from('applications').select('*'),
    supabase.from('rounds').select('*'),
  ]);
  if (apps.error) throw new Error(apps.error.message);
  if (rounds.error) throw new Error(rounds.error.message);
  const due = collectDue(apps.data as Application[], rounds.data as Round[], istDate(), TODAY_WINDOWS);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Today</h1>
      {isEmpty(due) && (
        <p className="text-muted-foreground">
          Nothing to check today. <Link href="/applications/new" className="underline">Add an application</Link>
        </p>
      )}
      <Section title="Overdue" count={due.overdue.length}>
        {due.overdue.map((a) => (
          <TodayItem key={a.id} app={a}> · was due {formatDate(a.follow_up_on!)}</TodayItem>
        ))}
      </Section>
      <Section title="Due today" count={due.dueToday.length}>
        {due.dueToday.map((a) => <TodayItem key={a.id} app={a} />)}
      </Section>
      <Section title="Rounds in the next 7 days" count={due.rounds.length}>
        {due.rounds.map((r) => (
          <li key={r.id} className="rounded-lg border p-3">
            <Link href={`/applications/${r.application_id}`} className="font-medium hover:underline">
              {r.application.company}: {r.name}
            </Link>
            <p className="text-sm text-muted-foreground">{formatDateTime(r.scheduled_at!)}</p>
          </li>
        ))}
      </Section>
      <Section title="Deadlines in the next 7 days" count={due.deadlines.length}>
        {due.deadlines.map((a) => (
          <TodayItem key={a.id} app={a}> · deadline {formatDate(a.deadline!)}</TodayItem>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">
        {title} <span className="text-muted-foreground">({count})</span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

// Per-user data streams in behind the fallback (Cache Components needs the data access inside <Suspense>).
export default function TodayPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TodayPageContent />
    </Suspense>
  );
}
