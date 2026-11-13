import { formatDate, formatDateTime, type ISODate } from './dates';
import type { Application, Profile, Round } from './domain';
import { collectDue, DIGEST_WINDOWS, isEmpty, type DueItems } from './due';

export type Digest = { profile: Profile; items: DueItems };

export function buildDigests(profiles: Profile[], apps: Application[], rounds: Round[], today: ISODate): Digest[] {
  return profiles
    .filter((p) => p.digest_enabled && (p.last_digest_on === null || p.last_digest_on < today))
    .map((profile) => ({
      profile,
      items: collectDue(
        apps.filter((a) => a.user_id === profile.id),
        rounds.filter((r) => r.user_id === profile.id),
        today,
        DIGEST_WINDOWS,
      ),
    }))
    .filter((d) => !isEmpty(d.items));
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

export function renderDigest({ items }: Digest, siteUrl: string) {
  const link = (id: string) => `${siteUrl}/applications/${id}`;
  const sections = [
    {
      title: 'Overdue follow-ups',
      lines: items.overdue.map((a) => ({ id: a.id, text: `${a.company}: ${a.role} (was due ${formatDate(a.follow_up_on!)})` })),
    },
    { title: 'Follow up today', lines: items.dueToday.map((a) => ({ id: a.id, text: `${a.company}: ${a.role}` })) },
    {
      title: 'Upcoming rounds',
      lines: items.rounds.map((r) => ({
        id: r.application_id,
        text: `${r.application.company}: ${r.name}, ${formatDateTime(r.scheduled_at!)}`,
      })),
    },
    {
      title: 'Closing soon',
      lines: items.deadlines.map((a) => ({ id: a.id, text: `${a.company}: ${a.role} (deadline ${formatDate(a.deadline!)})` })),
    },
  ].filter((s) => s.lines.length > 0);

  const count = sections.reduce((n, s) => n + s.lines.length, 0);
  const subject = `Job tracker: ${count} ${count === 1 ? 'thing' : 'things'} to check today`;
  const text = [
    ...sections.map((s) => `${s.title}\n${s.lines.map((l) => `- ${l.text}\n  ${link(l.id)}`).join('\n')}`),
    `Open Job Tracker: ${siteUrl}/`,
  ].join('\n\n');
  const html =
    sections
      .map(
        (s) =>
          `<h3>${esc(s.title)}</h3><ul>${s.lines
            .map((l) => `<li><a href="${esc(link(l.id))}">${esc(l.text)}</a></li>`)
            .join('')}</ul>`,
      )
      .join('') + `<p><a href="${esc(siteUrl)}/">Open Job Tracker</a></p>`;

  return { subject, text, html };
}
