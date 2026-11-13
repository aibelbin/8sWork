import { z } from 'zod';
import { istInputToIso, type ISODate } from './dates';
import { APPLY_METHODS, JOB_TYPES, ROUND_RESULTS, SOURCES, STATUSES, type Status } from './domain';

// Form fields arrive as strings; an empty or missing optional field means "no value".
const blankToNull = (v: unknown) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? null : v);
const optionalText = z.preprocess(blankToNull, z.string().trim().max(2000).nullable());
const optionalDate = z.preprocess(blankToNull, z.iso.date({ error: 'Enter a valid date' }).nullable());

export const applicationSchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(200),
  role: z.string().trim().min(1, 'Role is required').max(200),
  status: z.enum(STATUSES),
  apply_method: z.enum(APPLY_METHODS, { error: 'Choose how you applied' }),
  source: z.enum(SOURCES, { error: 'Choose where you found it' }),
  source_detail: optionalText,
  job_url: z.preprocess(blankToNull, z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) link' }).nullable()),
  contact_email: z.preprocess(blankToNull, z.email({ error: 'Enter a valid email' }).nullable()),
  resume_version: optionalText,
  job_type: z.preprocess(blankToNull, z.enum(JOB_TYPES).nullable()),
  location: optionalText,
  salary: optionalText,
  deadline: optionalDate,
  applied_on: optionalDate,
  follow_up_on: optionalDate,
  notes: optionalText,
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

export const roundSchema = z.object({
  name: z.string().trim().min(1, 'Round name is required').max(100),
  scheduled_at: z.preprocess(
    blankToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter a valid date and time')
      .transform(istInputToIso)
      .nullable(),
  ),
  result: z.enum(ROUND_RESULTS),
  notes: optionalText,
});
export type RoundInput = z.infer<typeof roundSchema>;

// applied_on is empty while a job is still "to apply", and is set the first time it leaves that status.
export function withAppliedOn<T extends { status: Status; applied_on: string | null }>(input: T, today: ISODate): T {
  return { ...input, applied_on: input.status === 'to_apply' ? null : (input.applied_on ?? today) };
}

const email = z.string().trim().toLowerCase().pipe(z.email({ error: 'Enter a valid email' }));
// bcrypt, which Supabase Auth uses, ignores anything past 72 bytes.
const newPassword = z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters');

export const signInSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export const signUpSchema = z.object({ email, password: newPassword });
export const emailOnlySchema = z.object({ email });
export const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], error: 'Passwords do not match' });
