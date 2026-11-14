import type { Application } from './domain';
import { postingFromApplication } from './postings';
import type { ServerSupabase } from './supabase/server';

// Keeps the application's own posting in step with the "Share this job" checkbox.
// An application tracking someone else's posting is left alone: that job is already on the board.
export async function syncShare(supabase: ServerSupabase, userId: string, app: Application, share: boolean): Promise<string | null> {
  let ownsPosting = false;
  if (app.posting_id) {
    const { data } = await supabase.from('postings').select('created_by').eq('id', app.posting_id).maybeSingle();
    if (data && data.created_by !== userId) return null;
    ownsPosting = !!data;
  }
  if (share && ownsPosting) {
    const { error } = await supabase.from('postings').update(postingFromApplication(app)).eq('id', app.posting_id!);
    return error?.message ?? null;
  }
  if (share) {
    const { data, error } = await supabase.from('postings').insert(postingFromApplication(app)).select('id').single();
    if (error) return error.message;
    const { error: linkError } = await supabase.from('applications').update({ posting_id: data.id }).eq('id', app.id);
    return linkError?.message ?? null;
  }
  if (ownsPosting) {
    const { error } = await supabase.from('postings').delete().eq('id', app.posting_id!);
    return error?.message ?? null;
  }
  return null;
}
