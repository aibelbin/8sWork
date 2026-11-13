import 'server-only';
import { istDate } from './dates';
import type { Application, Round } from './domain';
import { suggestFollowUp, type FollowUpEvent } from './follow-up';
import type { ServerSupabase } from './supabase/server';

// Loads the application with its rounds, applies the patch, and saves it with the suggested follow-up date.
export async function updateWithFollowUp(
  supabase: ServerSupabase,
  id: string,
  event: FollowUpEvent,
  makePatch: (app: Application) => Partial<Application> = () => ({}),
): Promise<string | null> {
  const { data, error } = await supabase.from('applications').select('*, rounds(*)').eq('id', id).single();
  if (error) return error.message;
  const app = data as Application & { rounds: Round[] };
  const patch = makePatch(app);
  const follow_up_on = suggestFollowUp({ ...app, ...patch }, event, istDate());
  const { error: saveError } = await supabase.from('applications').update({ ...patch, follow_up_on }).eq('id', id);
  return saveError?.message ?? null;
}
