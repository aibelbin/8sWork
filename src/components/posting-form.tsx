'use client';

import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sharePosting } from '@/app/actions/postings';
import { AutoFill } from '@/components/auto-fill';
import { Field, NativeSelect } from '@/components/form-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { APPLY_METHODS, JOB_TYPES } from '@/lib/domain';
import type { ExtractedJob } from '@/lib/extract/schema';

export function PostingForm() {
  const [state, formAction, pending] = useActionState(sharePosting, undefined);
  // Auto-fill results become the defaults; re-keying the form makes the uncontrolled inputs pick them up.
  const [prefill, setPrefill] = useState<ExtractedJob | null>(null);
  const [fillCount, setFillCount] = useState(0);

  useEffect(() => {
    if (state?.message) toast.error(state.message);
  }, [state]);

  const value = (key: string) => {
    const filled = prefill ? (key === 'details' ? prefill.notes : prefill[key as keyof ExtractedJob]) : null;
    return state?.values?.[key] ?? filled ?? '';
  };
  const errors = (key: string) => state?.errors?.[key];

  return (
    <div className="grid gap-6">
      <AutoFill
        onFill={(job) => {
          setPrefill(job);
          setFillCount((n) => n + 1);
        }}
      />
      <form key={fillCount} action={formAction} className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="company" errors={errors('company')}>
          <Input id="company" name="company" required defaultValue={value('company')} />
        </Field>
        <Field label="Role" htmlFor="role" errors={errors('role')}>
          <Input id="role" name="role" required defaultValue={value('role')} />
        </Field>
        <Field label="How to apply" htmlFor="apply_method" errors={errors('apply_method')}>
          <NativeSelect id="apply_method" name="apply_method" required options={APPLY_METHODS} placeholder="Choose…" defaultValue={value('apply_method')} />
        </Field>
        <Field label="Deadline" htmlFor="deadline" errors={errors('deadline')}>
          <Input id="deadline" name="deadline" type="date" defaultValue={value('deadline')} />
        </Field>
        <Field label="Job link" htmlFor="job_url" errors={errors('job_url')}>
          <Input id="job_url" name="job_url" type="url" placeholder="https://" defaultValue={value('job_url')} />
        </Field>
        <Field label="Contact email" htmlFor="contact_email" errors={errors('contact_email')}>
          <Input id="contact_email" name="contact_email" type="email" defaultValue={value('contact_email')} />
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
        <Field label="Details" htmlFor="details" errors={errors('details')} className="sm:col-span-2">
          <Textarea id="details" name="details" rows={4} placeholder="Eligibility, how to apply, referral code…" defaultValue={value('details')} />
        </Field>
        <Button type="submit" disabled={pending} className="justify-self-start">
          {pending ? 'Sharing…' : 'Share job'}
        </Button>
      </form>
    </div>
  );
}
