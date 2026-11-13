import type { Application, Profile, Round } from './domain';

let seq = 0;

export function makeApp(patch: Partial<Application> = {}): Application {
  seq++;
  return {
    id: `app-${seq}`,
    user_id: 'u1',
    company: `Company ${seq}`,
    role: 'SDE',
    status: 'applied',
    apply_method: 'email',
    source: 'linkedin',
    source_detail: null,
    job_url: null,
    contact_email: null,
    resume_version: null,
    job_type: null,
    location: null,
    salary: null,
    deadline: null,
    applied_on: '2026-11-01',
    follow_up_on: null,
    notes: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...patch,
  };
}

export function makeRound(patch: Partial<Round> & { application_id: string }): Round {
  seq++;
  return {
    id: `round-${seq}`,
    user_id: 'u1',
    name: 'Tech 1',
    scheduled_at: null,
    result: 'upcoming',
    notes: null,
    created_at: '2026-11-01T00:00:00Z',
    ...patch,
  };
}

export function makeProfile(patch: Partial<Profile> = {}): Profile {
  return { id: 'u1', email: 'u1@example.com', name: 'User One', digest_enabled: true, last_digest_on: null, ...patch };
}
