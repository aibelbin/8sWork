import { istDate } from '@/lib/dates';
import { buildDigests, renderDigest } from '@/lib/digest';
import type { Application, Profile, Round } from '@/lib/domain';
import { sendMail, verifyMailer } from '@/lib/mailer';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient();
  const today = istDate();

  const profiles = await db.from('profiles').select('*').eq('digest_enabled', true);
  if (profiles.error) throw new Error(profiles.error.message);
  const ids = (profiles.data as Profile[]).map((p) => p.id);
  if (ids.length === 0) return Response.json({ sent: 0, failed: 0 });

  const [apps, rounds] = await Promise.all([
    db.from('applications').select('*').in('user_id', ids).not('status', 'in', '(rejected,ghosted,withdrawn)'),
    db.from('rounds').select('*').in('user_id', ids).eq('result', 'upcoming'),
  ]);
  if (apps.error) throw new Error(apps.error.message);
  if (rounds.error) throw new Error(rounds.error.message);

  const digests = buildDigests(profiles.data as Profile[], apps.data as Application[], rounds.data as Round[], today);
  if (digests.length === 0) return Response.json({ sent: 0, failed: 0 });

  await verifyMailer(); // bad Gmail credentials fail the whole run loudly

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  let sent = 0;
  let failed = 0;
  for (const digest of digests) {
    try {
      await sendMail(digest.profile.email, renderDigest(digest, siteUrl));
      const { error } = await db.from('profiles').update({ last_digest_on: today }).eq('id', digest.profile.id);
      if (error) throw new Error(error.message);
      sent++;
    } catch (err) {
      failed++; // last_digest_on stays unset, so this user is retried on the next run
      console.error(`digest failed for profile ${digest.profile.id}`, err);
    }
  }
  return Response.json({ sent, failed });
}
