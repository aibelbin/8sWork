import type { ISODate } from './dates';
import type { Application, Posting } from './domain';
import { suggestFollowUp } from './follow-up';

export type PostingFields = Pick<
  Posting,
  'company' | 'role' | 'apply_method' | 'job_url' | 'contact_email' | 'job_type' | 'location' | 'salary' | 'deadline'
>;
export type NewApplication = Omit<Application, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

// Only these fields go on the shared board; status, rounds, resume, source and notes stay private.
export function postingFromApplication(app: PostingFields): PostingFields {
  const { company, role, apply_method, job_url, contact_email, job_type, location, salary, deadline } = app;
  return { company, role, apply_method, job_url, contact_email, job_type, location, salary, deadline };
}

export function applicationFromPosting(posting: Posting, today: ISODate): NewApplication {
  return {
    ...postingFromApplication(posting),
    status: 'to_apply',
    source: 'friend',
    source_detail: 'Find jobs',
    resume_version: null,
    applied_on: null,
    follow_up_on: suggestFollowUp({ status: 'to_apply', deadline: posting.deadline, applied_on: null, rounds: [] }, 'created', today),
    notes: posting.details,
    posting_id: posting.id,
  };
}
