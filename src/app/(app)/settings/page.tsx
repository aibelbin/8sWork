import { Button } from '@/components/ui/button';
import { setDigest, signOut } from '@/app/actions/settings';
import type { Profile } from '@/lib/domain';
import { requireUser } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw new Error(error.message);
  const profile = data as Profile;

  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="space-y-2">
        <h2 className="font-medium">Daily digest</h2>
        <p className="text-sm text-muted-foreground">
          {profile.digest_enabled
            ? `On. On days when something is due, a summary goes to ${profile.email} between 8 and 9 AM IST.`
            : 'Off. You will not get reminder emails.'}
        </p>
        <form action={setDigest}>
          <input type="hidden" name="enabled" value={String(!profile.digest_enabled)} />
          <Button type="submit" variant="outline">
            {profile.digest_enabled ? 'Turn off digest' : 'Turn on digest'}
          </Button>
        </form>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Account</h2>
        <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        <form action={signOut}>
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </section>
    </div>
  );
}
