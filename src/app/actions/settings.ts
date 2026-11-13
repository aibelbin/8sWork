'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function setDigest(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('profiles')
    .update({ digest_enabled: formData.get('enabled') === 'true' })
    .eq('id', user.id);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
