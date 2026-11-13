import { describe, expect, it } from 'vitest';
import { htmlToText } from './page-text';
import { isPublicAddress } from './public-address';
import { normalizeExtraction } from './schema';

describe('normalizeExtraction', () => {
  it('keeps valid fields and trims strings', () => {
    const job = normalizeExtraction({
      company: ' Acme ',
      role: 'SDE Intern',
      apply_method: 'email',
      contact_email: 'hr@acme.com',
      job_url: 'https://acme.com/jobs/1',
      location: 'Bangalore',
      salary: '12 LPA',
      deadline: '2026-11-30',
      job_type: 'internship',
      notes: 'Send CV with subject line.',
    });
    expect(job).toMatchObject({ company: 'Acme', apply_method: 'email', deadline: '2026-11-30', job_type: 'internship' });
  });

  it('drops anything invalid to null instead of failing', () => {
    const job = normalizeExtraction({
      company: '',
      role: 42,
      apply_method: 'carrier pigeon',
      contact_email: 'not an email',
      job_url: 'javascript:alert(1)',
      deadline: '30th Nov',
      job_type: 'gig',
    });
    expect(job).toEqual({
      company: null,
      role: null,
      apply_method: null,
      contact_email: null,
      job_url: null,
      location: null,
      salary: null,
      deadline: null,
      job_type: null,
      notes: null,
    });
  });

  it('treats a non-object answer as empty', () => {
    expect(normalizeExtraction('nope').company).toBeNull();
  });
});

describe('htmlToText', () => {
  it('keeps the title, visible text and JSON-LD job data, drops scripts and styles', () => {
    const html = `<html><head><title>SDE at Acme</title><style>.x{color:red}</style>
      <script>trackUser()</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"SDE"}</script></head>
      <body><h1>Software Engineer</h1><p>Apply by 30 Nov &amp; send CV</p></body></html>`;
    const text = htmlToText(html, 10_000);
    expect(text).toContain('SDE at Acme');
    expect(text).toContain('"@type":"JobPosting"');
    expect(text).toContain('Software Engineer');
    expect(text).toContain('Apply by 30 Nov & send CV');
    expect(text).not.toContain('trackUser');
    expect(text).not.toContain('color:red');
  });

  it('caps the length', () => {
    expect(htmlToText(`<p>${'a '.repeat(5000)}</p>`, 100).length).toBeLessThanOrEqual(100);
  });
});

describe('isPublicAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1'])(
    'blocks %s',
    (ip) => expect(isPublicAddress(ip)).toBe(false),
  );

  it.each(['8.8.8.8', '104.16.0.1', '2606:4700::1111'])('allows %s', (ip) => expect(isPublicAddress(ip)).toBe(true));
});
