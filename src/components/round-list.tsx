'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteRound, saveRound } from '@/app/actions/rounds';
import { Field, NativeSelect } from '@/components/form-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, isoToIstInput } from '@/lib/dates';
import { label, ROUND_RESULTS, type Round } from '@/lib/domain';

export function RoundList({ applicationId, rounds }: { applicationId: string; rounds: Round[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sorted = [...rounds].sort((a, b) => (a.scheduled_at ?? '9999').localeCompare(b.scheduled_at ?? '9999'));

  function remove(round: Round) {
    if (!confirm(`Delete round "${round.name}"?`)) return;
    startTransition(async () => {
      const { error } = await deleteRound(applicationId, round.id);
      if (error) toast.error(error);
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Rounds</h2>
      {sorted.length === 0 && <p className="text-sm text-muted-foreground">No rounds yet.</p>}
      <ol className="space-y-2 border-l pl-4">
        {sorted.map((round) =>
          editing === round.id ? (
            <li key={round.id}>
              <RoundForm applicationId={applicationId} round={round} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={round.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{round.name}</span>{' '}
                  <Badge variant="secondary">{label(round.result)}</Badge>
                  {round.scheduled_at && <p className="text-sm text-muted-foreground">{formatDateTime(round.scheduled_at)}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(round.id)}>Edit</Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(round)}>Delete</Button>
                </div>
              </div>
              {round.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{round.notes}</p>}
            </li>
          ),
        )}
      </ol>
      <RoundForm applicationId={applicationId} />
    </section>
  );
}

function RoundForm({ applicationId, round, onDone }: { applicationId: string; round?: Round; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(saveRound.bind(null, applicationId, round?.id ?? null), undefined);
  const prefix = round?.id ?? 'new';

  useEffect(() => {
    if (state?.ok) onDone?.();
    else if (state?.message) toast.error(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to a new action result; onDone is a fresh arrow each render
  }, [state]);

  const value = (key: 'name' | 'result' | 'notes') => state?.values?.[key] ?? round?.[key] ?? '';
  const scheduled = state?.values?.scheduled_at ?? (round?.scheduled_at ? isoToIstInput(round.scheduled_at) : '');

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
      <Field label="Round" htmlFor={`${prefix}-name`} errors={state?.errors?.name}>
        <Input id={`${prefix}-name`} name="name" required placeholder="e.g. OA, Tech 1, HR" defaultValue={value('name')} />
      </Field>
      <Field label="When (IST)" htmlFor={`${prefix}-scheduled_at`} errors={state?.errors?.scheduled_at}>
        <Input id={`${prefix}-scheduled_at`} name="scheduled_at" type="datetime-local" defaultValue={scheduled} />
      </Field>
      <Field label="Result" htmlFor={`${prefix}-result`} errors={state?.errors?.result}>
        <NativeSelect id={`${prefix}-result`} name="result" options={ROUND_RESULTS} defaultValue={value('result') || 'upcoming'} />
      </Field>
      <Field label="Notes" htmlFor={`${prefix}-notes`} errors={state?.errors?.notes} className="sm:col-span-3">
        <Textarea id={`${prefix}-notes`} name="notes" rows={2} defaultValue={value('notes')} />
      </Field>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : round ? 'Save round' : 'Add round'}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        )}
      </div>
    </form>
  );
}
