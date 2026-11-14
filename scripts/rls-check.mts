// Creates two throwaway users and checks that B cannot see or change A's data. Deletes both users at the end.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const password = crypto.randomUUID();
let failures = 0;

function check(ok: boolean, message: string) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
}

async function makeUser(tag: string) {
  const email = `rls-${tag}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const a = await makeUser('a');
const b = await makeUser('b');
try {
  const { data: app, error } = await a.client
    .from('applications')
    .insert({ company: 'RLS Co', role: 'Tester', apply_method: 'email', source: 'other' })
    .select()
    .single();
  if (error) throw error;
  const { error: roundError } = await a.client.from('rounds').insert({ application_id: app.id, name: 'OA' });
  if (roundError) throw roundError;

  const apps = await b.client.from('applications').select('id').eq('id', app.id);
  check(apps.data?.length === 0, "B cannot read A's application");

  const rounds = await b.client.from('rounds').select('id').eq('application_id', app.id);
  check(rounds.data?.length === 0, "B cannot read A's rounds");

  const updated = await b.client.from('applications').update({ company: 'hacked' }).eq('id', app.id).select();
  check(updated.data?.length === 0, "B cannot update A's application");

  const sneaky = await b.client.from('rounds').insert({ application_id: app.id, name: 'sneaky' });
  check(sneaky.error !== null, "B cannot add a round to A's application");

  const profiles = await b.client.from('profiles').select('id');
  check(profiles.data?.length === 1 && profiles.data[0].id === b.id, 'B sees only their own profile');

  const { data: posting, error: postingError } = await a.client
    .from('postings')
    .insert({ company: 'Shared Co', role: 'SDE', apply_method: 'form' })
    .select()
    .single();
  if (postingError) throw postingError;

  const seen = await b.client.from('postings').select('id').eq('id', posting.id);
  check(seen.data?.length === 1, "B can read A's posting");

  const edited = await b.client.from('postings').update({ company: 'hacked' }).eq('id', posting.id).select();
  check(edited.data?.length === 0, "B cannot update A's posting");

  const removed = await b.client.from('postings').delete().eq('id', posting.id).select();
  check(removed.data?.length === 0, "B cannot delete A's posting");

  const forged = await b.client.from('postings').insert({ company: 'X', role: 'Y', apply_method: 'form', created_by: a.id });
  check(forged.error !== null, 'B cannot post as A');

  const own = await b.client.from('postings').insert({ company: 'B Co', role: 'SDE', apply_method: 'email' }).select();
  check(own.data?.length === 1, 'B can share their own posting');
} finally {
  await admin.auth.admin.deleteUser(a.id);
  await admin.auth.admin.deleteUser(b.id);
}
process.exit(failures ? 1 : 0);
