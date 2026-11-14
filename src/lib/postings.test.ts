import { describe, expect, it } from 'vitest';
import { applicationFromPosting, postingFromApplication } from './postings';
import { makeApp, makePosting } from './test-fixtures';

describe('postingFromApplication', () => {
  it('copies only the posting fields, never private ones', () => {
    const app = makeApp({
      company: 'Zoho', role: 'SDE', apply_method: 'form', job_url: 'https://zoho.com/jobs/1',
      contact_email: 'hr@zoho.com', job_type: 'full_time', location: 'Chennai', salary: '8 LPA',
      deadline: '2026-12-05', status: 'in_progress', resume_version: 'v3', notes: 'my private note',
    });
    expect(postingFromApplication(app)).toEqual({
      company: 'Zoho', role: 'SDE', apply_method: 'form', job_url: 'https://zoho.com/jobs/1',
      contact_email: 'hr@zoho.com', job_type: 'full_time', location: 'Chennai', salary: '8 LPA',
      deadline: '2026-12-05',
    });
  });
});

describe('applicationFromPosting', () => {
  it('starts a to-apply application from the posting, follow-up the day before the deadline', () => {
    const posting = makePosting({ id: 'p1', company: 'Zoho', deadline: '2026-12-05', details: 'Use referral code X' });
    expect(applicationFromPosting(posting, '2026-11-14')).toMatchObject({
      company: 'Zoho', status: 'to_apply', source: 'friend', source_detail: 'Find jobs',
      notes: 'Use referral code X', posting_id: 'p1', applied_on: null, follow_up_on: '2026-12-04',
    });
  });

  it('leaves follow-up empty when there is no deadline', () => {
    expect(applicationFromPosting(makePosting({ deadline: null }), '2026-11-14').follow_up_on).toBeNull();
  });
});
