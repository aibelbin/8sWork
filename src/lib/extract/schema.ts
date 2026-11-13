import { z } from 'zod';
import { APPLY_METHODS, JOB_TYPES } from '../domain';

// Model output is untrusted: each field falls back to null rather than failing the whole extraction.
const text = (max: number) => z.string().trim().min(1).max(max).nullable().catch(null);

export const extractedJobSchema = z.object({
  company: text(200),
  role: text(200),
  apply_method: z.enum(APPLY_METHODS).nullable().catch(null),
  contact_email: z.string().trim().pipe(z.email()).nullable().catch(null),
  job_url: z.string().trim().pipe(z.url({ protocol: /^https?$/ })).nullable().catch(null),
  location: text(200),
  salary: text(200),
  deadline: z.iso.date().nullable().catch(null),
  job_type: z.enum(JOB_TYPES).nullable().catch(null),
  notes: text(2000),
});
export type ExtractedJob = z.infer<typeof extractedJobSchema>;

export function normalizeExtraction(raw: unknown): ExtractedJob {
  return extractedJobSchema.parse(raw && typeof raw === 'object' ? raw : {});
}

const nullable = (description: string) => ({ type: ['string', 'null'], description });
const nullableEnum = (values: readonly string[], description: string) => ({
  type: ['string', 'null'],
  enum: [...values, null],
  description,
});

// Strict structured-output schema sent to the model; normalizeExtraction re-validates the answer.
export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: Object.keys(extractedJobSchema.shape),
  properties: {
    company: nullable('Hiring company name.'),
    role: nullable('Job title or role.'),
    apply_method: nullableEnum(
      APPLY_METHODS,
      'email = send CV/resume to an email address; form = fill a Google Form or application form; portal = an Apply button on a careers site, LinkedIn or a job board; referral = needs a referral; other.',
    ),
    contact_email: nullable('Email address to apply to or contact, exactly as written.'),
    job_url: nullable('Link to the posting or application form (http/https).'),
    location: nullable('Work location(s), or Remote/Hybrid.'),
    salary: nullable('CTC, package or stipend exactly as written, e.g. "12 LPA" or "₹30,000/month".'),
    deadline: nullable('Last date to apply as YYYY-MM-DD.'),
    job_type: nullableEnum(JOB_TYPES, 'internship (incl. intern/trainee), full_time (incl. Full-time/permanent/FTE) or contract.'),
    notes: nullable('At most 3 short lines: eligibility (batch, CGPA, skills) and any special apply instructions (e.g. email subject line).'),
  },
} as const;
