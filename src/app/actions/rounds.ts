'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { updateWithFollowUp } from '@/lib/follow-up-db';
import type { ActionResult, FormState } from '@/lib/form-state';
import { roundSchema } from '@/lib/schemas';
import { requireUser } from '@/lib/supabase/server';

export async function saveRound(
  applicationId: string,
  roundId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const values = Object.fromEntries(formData) as Record<string, string>;
  const result = roundSchema.safeParse(values);
  if (!result.success) return { errors: z.flattenError(result.error).fieldErrors, values };

  const { error } = roundId
    ? await supabase.from('rounds').update(result.data).eq('id', roundId)
    : await supabase.from('rounds').insert({ ...result.data, application_id: applicationId });
  if (error) return { message: error.message, values };

  const followUpError = await updateWithFollowUp(supabase, applicationId, 'round_saved');
  if (followUpError) return { message: `Round saved, but the follow-up date was not updated: ${followUpError}` };

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteRound(applicationId: string, roundId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('rounds').delete().eq('id', roundId).eq('application_id', applicationId);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return {};
}
