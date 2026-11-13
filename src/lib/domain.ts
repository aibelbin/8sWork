export const STATUSES = ['to_apply', 'applied', 'in_progress', 'offer', 'rejected', 'ghosted', 'withdrawn'] as const;
export const CLOSED_STATUSES = ['rejected', 'ghosted', 'withdrawn'] as const;
export const APPLY_METHODS = ['email', 'form', 'portal', 'referral', 'other'] as const;
export const SOURCES = ['college_group', 'linkedin', 'company_site', 'job_board', 'friend', 'other'] as const;
export const JOB_TYPES = ['internship', 'full_time', 'contract'] as const;
export const ROUND_RESULTS = ['upcoming', 'passed', 'failed', 'awaiting'] as const;

export type Status = (typeof STATUSES)[number];
export type ApplyMethod = (typeof APPLY_METHODS)[number];
export type Source = (typeof SOURCES)[number];
export type JobType = (typeof JOB_TYPES)[number];
export type RoundResult = (typeof ROUND_RESULTS)[number];

export type Application = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: Status;
  apply_method: ApplyMethod;
  source: Source;
  source_detail: string | null;
  job_url: string | null;
  contact_email: string | null;
  resume_version: string | null;
  job_type: JobType | null;
  location: string | null;
  salary: string | null;
  deadline: string | null;
  applied_on: string | null;
  follow_up_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Round = {
  id: string;
  application_id: string;
  user_id: string;
  name: string;
  scheduled_at: string | null;
  result: RoundResult;
  notes: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  digest_enabled: boolean;
  last_digest_on: string | null;
};

export function isOpen(status: Status): boolean {
  return !(CLOSED_STATUSES as readonly Status[]).includes(status);
}

const LABELS: Record<string, string> = {
  to_apply: 'To apply',
  applied: 'Applied',
  in_progress: 'In progress',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
  withdrawn: 'Withdrawn',
  email: 'Email',
  form: 'Form',
  portal: 'Portal',
  referral: 'Referral',
  other: 'Other',
  college_group: 'College group',
  linkedin: 'LinkedIn',
  company_site: 'Company site',
  job_board: 'Job board',
  friend: 'Friend',
  internship: 'Internship',
  full_time: 'Full-time',
  contract: 'Contract',
  upcoming: 'Upcoming',
  passed: 'Passed',
  failed: 'Failed',
  awaiting: 'Awaiting result',
};

export function label(value: string): string {
  return LABELS[value] ?? value;
}
