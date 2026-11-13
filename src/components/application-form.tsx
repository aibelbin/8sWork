'use client';

import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createApplication, updateApplication } from '@/app/actions/applications';
import { Field, NativeSelect } from '@/components/form-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { APPLY_METHODS, JOB_TYPES, SOURCES, STATUSES, type Application, type Round, type Status } from '@/lib/domain';
import { suggestFollowUp } from '@/lib/follow-up';

type Tracked = { status: Status; appliedOn: string; deadline: string };

// `today` comes from the server so a prerendered page never bakes in a stale date.
export function ApplicationForm({ application, today }: { application?: Application & { rounds: Round[] }; today: string }) {
  const isNew = !application;
  const [state, formAction, pending] = useActionState(
    isNew ? createApplication : updateApplication.bind(null, application.id),
    undefined,
  );

  // Status and the dates it depends on are controlled so the follow-up suggestion updates as they change.
  const [tracked, setTracked] = useState<Tracked>({
    status: application?.status ?? 'applied',
    appliedOn: application?.applied_on ?? today,
    deadline: application?.deadline ?? '',
  });
  const suggest = (t: Tracked) =>
    suggestFollowUp(
      { status: t.status, applied_on: t.appliedOn || null, deadline: t.deadline || null, rounds: application?.rounds ?? [] },
      isNew ? 'created' : 'status_changed',
      today,
    ) ?? '';
  const [followUp, setFollowUp] = useState(isNew ? suggest(tracked) : (application.follow_up_on ?? ''));

  function track(patch: Partial<Tracked>) {
    const next = { ...tracked, ...patch };
    setTracked(next);
    setFollowUp(suggest(next));
  }

  useEffect(() => {
    if (state?.ok) toast.success('Saved');
    else if (state?.message) toast.error(state.message);
  }, [state]);

  // After a failed submit, show what the user typed rather than the saved value.
  const value = (key: keyof Application) => state?.values?.[key] ?? String(application?.[key] ?? '');
  const errors = (key: string) => state?.errors?.[key];

  const deadlineField = (
    <Field label="Deadline" htmlFor="deadline" errors={errors('deadline')}>
      <Input id="deadline" name="deadline" type="date" value={tracked.deadline} onChange={(e) => track({ deadline: e.target.value })} />
    </Field>
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="company" errors={errors('company')}>
          <Input id="company" name="company" required defaultValue={value('company')} />
        </Field>
        <Field label="Role" htmlFor="role" errors={errors('role')}>
          <Input id="role" name="role" required defaultValue={value('role')} />
        </Field>
        <Field label="How you applied" htmlFor="apply_method" errors={errors('apply_method')}>
          <NativeSelect id="apply_method" name="apply_method" required options={APPLY_METHODS} placeholder="Choose…" defaultValue={value('apply_method')} />
        </Field>
        <Field label="Where you found it" htmlFor="source" errors={errors('source')}>
          <NativeSelect id="source" name="source" required options={SOURCES} placeholder="Choose…" defaultValue={value('source')} />
        </Field>
        <Field label="Status" htmlFor="status" errors={errors('status')}>
          <NativeSelect id="status" name="status" options={STATUSES} value={tracked.status} onChange={(e) => track({ status: e.target.value as Status })} />
        </Field>
        {tracked.status === 'to_apply' ? (
          deadlineField
        ) : (
          <Field label="Applied on" htmlFor="applied_on" errors={errors('applied_on')}>
            <Input id="applied_on" name="applied_on" type="date" value={tracked.appliedOn} onChange={(e) => track({ appliedOn: e.target.value })} />
          </Field>
        )}
        <Field label="Follow up on" htmlFor="follow_up_on" errors={errors('follow_up_on')}>
          <Input id="follow_up_on" name="follow_up_on" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </Field>
      </div>

      <details open={!isNew || !!state?.errors} className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">More details</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {tracked.status !== 'to_apply' && deadlineField}
          <Field label="Source detail" htmlFor="source_detail" errors={errors('source_detail')}>
            <Input id="source_detail" name="source_detail" placeholder="e.g. CSE 2026 WhatsApp group" defaultValue={value('source_detail')} />
          </Field>
          <Field label="Job link" htmlFor="job_url" errors={errors('job_url')}>
            <Input id="job_url" name="job_url" type="url" placeholder="https://" defaultValue={value('job_url')} />
          </Field>
          <Field label="Contact email" htmlFor="contact_email" errors={errors('contact_email')}>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={value('contact_email')} />
          </Field>
          <Field label="Resume version" htmlFor="resume_version" errors={errors('resume_version')}>
            <Input id="resume_version" name="resume_version" placeholder="e.g. SDE v3" defaultValue={value('resume_version')} />
          </Field>
          <Field label="Job type" htmlFor="job_type" errors={errors('job_type')}>
            <NativeSelect id="job_type" name="job_type" options={JOB_TYPES} placeholder="—" defaultValue={value('job_type')} />
          </Field>
          <Field label="Location" htmlFor="location" errors={errors('location')}>
            <Input id="location" name="location" placeholder="e.g. Bangalore / Remote" defaultValue={value('location')} />
          </Field>
          <Field label="CTC / package" htmlFor="salary" errors={errors('salary')}>
            <Input id="salary" name="salary" placeholder="e.g. 12 LPA or 30k/month stipend" defaultValue={value('salary')} />
          </Field>
          <Field label="Notes" htmlFor="notes" errors={errors('notes')} className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={4} defaultValue={value('notes')} />
          </Field>
        </div>
      </details>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? 'Saving…' : isNew ? 'Add application' : 'Save changes'}
      </Button>
    </form>
  );
}
