'use client';

import Link from 'next/link';
import { useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { checkApplication, snoozeApplication } from '@/app/actions/applications';
import { StatusSelect } from '@/components/status-select';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/form-state';
import type { Application } from '@/lib/domain';

export function TodayItem({ app, children }: { app: Application; children?: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const { error } = await action();
      if (error) toast.error(error);
    });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <Link href={`/applications/${app.id}`} className="font-medium hover:underline">{app.company}</Link>
        <p className="text-sm text-muted-foreground">
          {app.role}
          {children}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" disabled={pending} onClick={() => run(() => checkApplication(app.id))}>Checked</Button>
        {[1, 3, 7].map((days) => (
          <Button
            key={days}
            size="sm"
            variant="outline"
            disabled={pending}
            aria-label={`Snooze ${days} day${days > 1 ? 's' : ''}`}
            onClick={() => run(() => snoozeApplication(app.id, days))}
          >
            +{days}d
          </Button>
        ))}
        <StatusSelect id={app.id} status={app.status} />
      </div>
    </li>
  );
}
