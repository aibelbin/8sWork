'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { istDate } from '@/lib/dates';
import type { Posting } from '@/lib/domain';
import type { ActionResult } from '@/lib/form-state';
import { applicationFromPosting } from '@/lib/postings';
import { requireUser } from '@/lib/supabase/server';

export async function trackPosting(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: 'Invalid job' };
  const { supabase } = await requireUser();
  const { data: posting } = await supabase.from('postings').select('*').eq('id', id).maybeSingle();
  if (!posting) return { error: 'That job was removed' };
  const { data: existing } = await supabase.from('applications').select('id').eq('posting_id', id).maybeSingle();
  if (existing) redirect(`/applications/${existing.id}`);
  const { data, error } = await supabase
    .from('applications')
    .insert(applicationFromPosting(posting as Posting, istDate()))
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  redirect(`/applications/${data.id}`);
}

export async function removePosting(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: 'Invalid job' };
  const { supabase } = await requireUser();
  const { error } = await supabase.from('postings').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/jobs');
  return {};
}
