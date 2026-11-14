'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { addDays, istDate } from '@/lib/dates';
import { STATUSES, type Application } from '@/lib/domain';
import { updateWithFollowUp } from '@/lib/follow-up-db';
import type { ActionResult, FormState } from '@/lib/form-state';
import { applicationSchema, withAppliedOn } from '@/lib/schemas';
import { syncShare } from '@/lib/share-db';
import { requireUser } from '@/lib/supabase/server';

function parseApplicationForm(formData: FormData) {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const result = applicationSchema.safeParse(values);
  if (!result.success) return { values, errors: z.flattenError(result.error).fieldErrors };
  return { values, data: withAppliedOn(result.data, istDate()) };
}

const SHARE_FAILED = 'Saved, but sharing failed: ';

export async function createApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const parsed = parseApplicationForm(formData);
  if ('errors' in parsed) return { errors: parsed.errors, values: parsed.values };
  const { data, error } = await supabase.from('applications').insert(parsed.data).select().single();
  if (error) return { message: error.message, values: parsed.values };
  const shareError = await syncShare(supabase, user.id, data as Application, formData.get('share') === 'on');
  revalidatePath('/', 'layout');
  redirect(`/applications/${data.id}${shareError ? '?share=failed' : ''}`);
}

export async function updateApplication(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const parsed = parseApplicationForm(formData);
  if ('errors' in parsed) return { errors: parsed.errors, values: parsed.values };
  const { data, error } = await supabase.from('applications').update(parsed.data).eq('id', id).select().single();
  if (error) return { message: error.message, values: parsed.values };
  const shareError = await syncShare(supabase, user.id, data as Application, formData.get('share') === 'on');
  revalidatePath('/', 'layout');
  return shareError ? { message: SHARE_FAILED + shareError } : { ok: true, message: 'Saved' };
}

export async function deleteApplication(id: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from('applications').select('posting_id').eq('id', id).maybeSingle();
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw new Error(error.message);
  // A shared application takes its posting with it; RLS and the created_by filter leave others' postings alone.
  if (data?.posting_id) await supabase.from('postings').delete().eq('id', data.posting_id).eq('created_by', user.id);
  revalidatePath('/', 'layout');
  redirect('/applications');
}

export async function setStatus(id: string, status: string): Promise<ActionResult> {
  const parsed = z.enum(STATUSES).safeParse(status);
  if (!parsed.success) return { error: 'Invalid status' };
  const { supabase } = await requireUser();
  const error = await updateWithFollowUp(supabase, id, 'status_changed', (app) =>
    withAppliedOn({ status: parsed.data, applied_on: app.applied_on }, istDate()),
  );
  if (error) return { error };
  revalidatePath('/', 'layout');
  return {};
}

export async function checkApplication(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const error = await updateWithFollowUp(supabase, id, 'checked');
  if (error) return { error };
  revalidatePath('/', 'layout');
  return {};
}

export async function snoozeApplication(id: string, days: number): Promise<ActionResult> {
  if (![1, 3, 7].includes(days)) return { error: 'Invalid snooze' };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('applications')
    .update({ follow_up_on: addDays(istDate(), days) })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return {};
}
