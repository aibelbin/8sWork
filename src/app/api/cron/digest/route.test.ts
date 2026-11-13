import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    throw new Error('should not reach the database');
  }),
}));
vi.mock('@/lib/mailer', () => ({ verifyMailer: vi.fn(), sendMail: vi.fn() }));

import { GET } from './route';

const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/digest', authorization ? { headers: { authorization } } : undefined);

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/cron/digest', () => {
  it('rejects requests without the secret', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect((await GET(request())).status).toBe(401);
  });

  it('rejects a wrong secret', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect((await GET(request('Bearer nope'))).status).toBe(401);
  });

  it('rejects everything when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await GET(request('Bearer '))).status).toBe(401);
    expect((await GET(request('Bearer undefined'))).status).toBe(401);
  });
});
