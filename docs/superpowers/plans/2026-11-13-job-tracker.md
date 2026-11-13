# Job Application Tracker (Iteration 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A multi-user website where each person signs in with Google, tracks job applications and their rounds, sees what to check today, and gets a daily email digest of due follow-ups.

**Architecture:** One Next.js 16 App Router app on Vercel. Supabase provides Google sign-in and Postgres. Row-level security keeps each user's rows private. All date and reminder logic lives in small pure TypeScript modules under `src/lib/`, which have unit tests. Pages and server actions are thin wrappers around those modules. A daily Vercel Cron job calls a route that builds per-user digests and sends them through Gmail SMTP.

**Tech Stack:** Next.js 16.4 (App Router, `src/` dir, TypeScript), Tailwind CSS 4, shadcn/ui, `@supabase/ssr` 0.12 + `@supabase/supabase-js` 2, zod 4, nodemailer, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-13-job-tracker-design.md`

## Global Constraints

- "Today" is always the calendar date in `Asia/Kolkata` (IST, UTC+05:30, no DST). Dates are `YYYY-MM-DD` strings everywhere.
- Sign-in is Google only, through Supabase Auth.
- The browser only ever gets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` and `CRON_SECRET` are server-only.
- RLS is on for `profiles`, `applications` and `rounds`, with the policy `user_id = auth.uid()` (`id = auth.uid()` for profiles).
- Closed statuses are `rejected`, `ghosted` and `withdrawn`. They never appear on the Today page or in digests.
- Cron schedule: `30 2 * * *` (08:00 IST).
- Job links must be `http` or `https` (they are rendered as `href`).
- Next.js 16: middleware is `src/proxy.ts` exporting `proxy`. `params`, `searchParams` and `cookies()` are Promises.
- The developer's laptop is a fanless MacBook Air: do not run `next build` locally (Vercel builds on deploy). Use `npm run typecheck`, `npm test` and `npm run dev`.
- Git: commit after every task. Never add `Co-Authored-By`, "Generated with" or any AI attribution to commits. Before any push, run `git log --format=%B origin/main..HEAD | grep -i co-authored` and stop if it matches.
- Deploying (Task 14) and creating cloud resources (Task 6) need the user's confirmation first.

## File Structure

```
.env.example                          env var names, no values
vercel.json                           cron schedule
vitest.config.ts                      test runner config with @ alias
supabase/migrations/20261113000000_init.sql   tables, enums, triggers, RLS
scripts/rls-check.mts                 two-user RLS verification script
src/proxy.ts                          refreshes Supabase session, redirects signed-out users
src/lib/domain.ts                     enums, row types, labels, isOpen
src/lib/dates.ts                      IST date helpers and formatting
src/lib/follow-up.ts                  suggestFollowUp (pure)
src/lib/schemas.ts                    zod form schemas, withAppliedOn
src/lib/due.ts                        collectDue: what is overdue/today/upcoming (pure)
src/lib/digest.ts                     buildDigests, renderDigest (pure)
src/lib/test-fixtures.ts              makeApp, makeRound, makeProfile for tests
src/lib/form-state.ts                 FormState and ActionResult types
src/lib/follow-up-db.ts               load app + rounds, save patch + suggested follow-up
src/lib/mailer.ts                     nodemailer Gmail transport
src/lib/supabase/client.ts            browser client
src/lib/supabase/server.ts            server client + requireUser
src/lib/supabase/admin.ts             service-role client (cron only)
src/components/form-controls.tsx      NativeSelect, Field, selectClass
src/components/application-form.tsx   create/edit form with follow-up suggestion
src/components/round-list.tsx         rounds timeline + inline add/edit/delete
src/components/status-select.tsx      inline status change
src/components/today-item.tsx         Today row with Checked / Snooze / status
src/components/delete-application-button.tsx
src/app/layout.tsx                    root layout (modified: title, Toaster)
src/app/login/page.tsx, google-button.tsx
src/app/auth/callback/route.ts        OAuth code exchange
src/app/(app)/layout.tsx              nav shell
src/app/(app)/error.tsx               error boundary
src/app/(app)/page.tsx                Today
src/app/(app)/applications/page.tsx   list
src/app/(app)/applications/new/page.tsx
src/app/(app)/applications/[id]/page.tsx
src/app/(app)/settings/page.tsx
src/app/actions/applications.ts       create/update/delete/setStatus/check/snooze
src/app/actions/rounds.ts             saveRound/deleteRound
src/app/actions/settings.ts           setDigest/signOut
src/app/api/cron/digest/route.ts      daily digest job (+ route.test.ts)
```

---

### Task 1: Scaffold the project

**Files:**
- Create: whole Next.js scaffold, `vitest.config.ts`, `.env.example`
- Modify: `package.json` (scripts), `.gitignore`
- Delete: `src/app/page.tsx` (the `(app)` route group will own `/`)

**Interfaces:**
- Produces: `@/*` import alias to `src/*`; `npm test`, `npm run typecheck`, `npm run lint`, `npm run dev`; shadcn components at `@/components/ui/{button,input,label,textarea,badge,sonner,table}` and `cn` at `@/lib/utils`.

- [ ] **Step 1: Create the Next.js app in the repo root**

The repo already contains `.git` and `docs/`, both of which create-next-app allows.

```bash
cd /Users/aibelbinzacariah/Documents/Code/8sWork
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

Expected: "Success! Created ..." If it refuses because of existing files, move `docs` to the scratchpad, rerun, and move it back.

- [ ] **Step 2: Install dependencies**

```bash
npm i @supabase/supabase-js @supabase/ssr zod nodemailer server-only
npm i -D vitest @types/nodemailer
```

- [ ] **Step 3: Add shadcn/ui and the components we use**

```bash
npx shadcn@latest init --defaults --yes
npx shadcn@latest add button input label textarea badge sonner table --yes
```

Expected: files in `src/components/ui/` and `src/lib/utils.ts`.

- [ ] **Step 4: Add scripts, test config, env example, gitignore entries**

```bash
npm pkg set scripts.test="vitest run" scripts.typecheck="tsc --noEmit"
rm src/app/page.tsx
printf '\n!.env.example\nsupabase/.temp\n' >> .gitignore
```

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node' },
});
```

Create `.env.example`:

```bash
# Supabase (set by the Vercel Marketplace integration; pull with `vercel env pull .env.local`)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
POSTGRES_URL_NON_POOLING=
# Digest email (Gmail account with 2-step verification + an app password)
GMAIL_USER=
GMAIL_APP_PASSWORD=
# Random secret the cron request must carry: openssl rand -hex 32
CRON_SECRET=
# Base URL used in email links, e.g. http://localhost:3000 or https://job-tracker.vercel.app
NEXT_PUBLIC_SITE_URL=
```

- [ ] **Step 5: Verify the scaffold**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with shadcn, Supabase and Vitest deps"
```

---

### Task 2: Domain types and IST date helpers

**Files:**
- Create: `src/lib/domain.ts`, `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Produces (`domain.ts`): `STATUSES`, `CLOSED_STATUSES`, `APPLY_METHODS`, `SOURCES`, `JOB_TYPES`, `ROUND_RESULTS` (readonly tuples); types `Status`, `ApplyMethod`, `Source`, `JobType`, `RoundResult`, `Application`, `Round`, `Profile`; `isOpen(status: Status): boolean`; `label(value: string): string`.
- Produces (`dates.ts`): `type ISODate = string`; `istDate(at?: Date | string): ISODate`; `addDays(date: ISODate, days: number): ISODate`; `isoToIstInput(iso: string): string` (gives `YYYY-MM-DDTHH:mm` in IST); `istInputToIso(local: string): string`; `formatDate(date: ISODate): string`; `formatDateTime(iso: string): string`.

- [ ] **Step 1: Write the failing test** in `src/lib/dates.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { addDays, istDate, istInputToIso, isoToIstInput } from './dates';

describe('istDate', () => {
  it('returns the IST calendar date', () => {
    expect(istDate('2026-11-13T18:00:00Z')).toBe('2026-11-13'); // 23:30 IST
  });

  it('rolls over at IST midnight, not UTC midnight', () => {
    expect(istDate('2026-11-13T18:30:00Z')).toBe('2026-11-14'); // 00:00 IST
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('IST datetime-local conversion', () => {
  it('converts an IST input value to UTC ISO and back', () => {
    expect(istInputToIso('2026-11-20T10:00')).toBe('2026-11-20T04:30:00.000Z');
    expect(isoToIstInput('2026-11-20T04:30:00.000Z')).toBe('2026-11-20T10:00');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL, "Failed to resolve import ./dates".

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```ts
export type ISODate = string; // 'YYYY-MM-DD'

// IST is UTC+05:30 with no DST, so a fixed offset is exact.
const IST_OFFSET_MS = 330 * 60_000;

export function istDate(at: Date | string = new Date()): ISODate {
  return new Date(new Date(at).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoToIstInput(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

export function istInputToIso(local: string): string {
  return new Date(`${local}:00+05:30`).toISOString();
}

export function formatDate(date: ISODate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}
```

- [ ] **Step 4: Create `src/lib/domain.ts`** (types and constants only, so no separate test)

```ts
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
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/lib/dates.test.ts && npm run typecheck`
Expected: 4 tests PASS, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain.ts src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: add domain types and IST date helpers"
```

---

### Task 3: Follow-up rules

**Files:**
- Create: `src/lib/follow-up.ts`
- Test: `src/lib/follow-up.test.ts`

**Interfaces:**
- Consumes: `addDays`, `istDate`, `ISODate` from `@/lib/dates`; `Application`, `Round`, `CLOSED_STATUSES`, `Status` from `@/lib/domain`.
- Produces:
  ```ts
  type FollowUpEvent = 'created' | 'status_changed' | 'round_saved' | 'checked';
  type FollowUpInput = Pick<Application, 'status' | 'deadline' | 'applied_on'> & {
    rounds: Pick<Round, 'scheduled_at' | 'result'>[];
  };
  function suggestFollowUp(app: FollowUpInput, event: FollowUpEvent, today: ISODate): ISODate | null;
  ```

- [ ] **Step 1: Write the failing test** in `src/lib/follow-up.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { suggestFollowUp, type FollowUpInput } from './follow-up';

const today = '2026-11-13';
const app = (patch: Partial<FollowUpInput> = {}): FollowUpInput => ({
  status: 'applied',
  deadline: null,
  applied_on: '2026-11-10',
  rounds: [],
  ...patch,
});

describe('suggestFollowUp', () => {
  it.each(['rejected', 'ghosted', 'withdrawn'] as const)('%s clears the follow-up', (status) => {
    expect(suggestFollowUp(app({ status }), 'status_changed', today)).toBeNull();
  });

  it('to_apply with a deadline: the day before the deadline', () => {
    expect(suggestFollowUp(app({ status: 'to_apply', deadline: '2026-11-20', applied_on: null }), 'created', today)).toBe('2026-11-19');
  });

  it('to_apply without a deadline: no follow-up', () => {
    expect(suggestFollowUp(app({ status: 'to_apply', applied_on: null }), 'created', today)).toBeNull();
  });

  it('checked on to_apply follows the deadline rule', () => {
    expect(suggestFollowUp(app({ status: 'to_apply', deadline: '2026-11-20' }), 'checked', today)).toBe('2026-11-19');
  });

  it('offer: today + 3, whatever the event', () => {
    expect(suggestFollowUp(app({ status: 'offer' }), 'status_changed', today)).toBe('2026-11-16');
    expect(suggestFollowUp(app({ status: 'offer' }), 'checked', today)).toBe('2026-11-16');
  });

  it('upcoming scheduled round: the day after the earliest one, in IST', () => {
    const rounds = [
      { result: 'upcoming' as const, scheduled_at: '2026-11-25T05:00:00Z' },
      { result: 'upcoming' as const, scheduled_at: '2026-11-20T18:30:00Z' }, // 21 Nov 00:00 IST
    ];
    expect(suggestFollowUp(app({ status: 'in_progress', rounds }), 'round_saved', today)).toBe('2026-11-22');
  });

  it('an applied application with an upcoming round also uses the round', () => {
    const rounds = [{ result: 'upcoming' as const, scheduled_at: '2026-11-15T05:00:00Z' }];
    expect(suggestFollowUp(app({ rounds }), 'round_saved', today)).toBe('2026-11-16');
  });

  it('ignores rounds that are finished or unscheduled', () => {
    const rounds = [
      { result: 'passed' as const, scheduled_at: '2026-11-12T05:00:00Z' },
      { result: 'upcoming' as const, scheduled_at: null },
    ];
    expect(suggestFollowUp(app({ status: 'in_progress', rounds }), 'round_saved', today)).toBe('2026-11-18');
  });

  it('in_progress with no upcoming round: today + 5', () => {
    expect(suggestFollowUp(app({ status: 'in_progress' }), 'checked', today)).toBe('2026-11-18');
  });

  it('applied on create or status change: applied_on + 7', () => {
    expect(suggestFollowUp(app(), 'created', today)).toBe('2026-11-17');
    expect(suggestFollowUp(app(), 'status_changed', today)).toBe('2026-11-17');
  });

  it('applied without applied_on falls back to today + 7', () => {
    expect(suggestFollowUp(app({ applied_on: null }), 'created', today)).toBe('2026-11-20');
  });

  it('applied on checked or round saved: today + 7', () => {
    expect(suggestFollowUp(app(), 'checked', today)).toBe('2026-11-20');
    expect(suggestFollowUp(app(), 'round_saved', today)).toBe('2026-11-20');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/follow-up.test.ts`
Expected: FAIL, "Failed to resolve import ./follow-up".

- [ ] **Step 3: Implement `src/lib/follow-up.ts`**

```ts
import { addDays, istDate, type ISODate } from './dates';
import { isOpen, type Application, type Round } from './domain';

export type FollowUpEvent = 'created' | 'status_changed' | 'round_saved' | 'checked';

export type FollowUpInput = Pick<Application, 'status' | 'deadline' | 'applied_on'> & {
  rounds: Pick<Round, 'scheduled_at' | 'result'>[];
};

// Rules from the spec's "Follow-up rules" table, checked top to bottom.
export function suggestFollowUp(app: FollowUpInput, event: FollowUpEvent, today: ISODate): ISODate | null {
  if (!isOpen(app.status)) return null;
  if (app.status === 'to_apply') return app.deadline ? addDays(app.deadline, -1) : null;
  if (app.status === 'offer') return addDays(today, 3);

  const nextRound = app.rounds
    .filter((r) => r.result === 'upcoming' && r.scheduled_at)
    .map((r) => istDate(r.scheduled_at!))
    .sort()[0];
  if (nextRound) return addDays(nextRound, 1);

  if (app.status === 'in_progress') return addDays(today, 5);

  const base = event === 'created' || event === 'status_changed' ? (app.applied_on ?? today) : today;
  return addDays(base, 7);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/follow-up.test.ts`
Expected: 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/follow-up.ts src/lib/follow-up.test.ts
git commit -m "feat: add follow-up date rules"
```

---

### Task 4: Form schemas

**Files:**
- Create: `src/lib/schemas.ts`, `src/lib/form-state.ts`
- Test: `src/lib/schemas.test.ts`

**Interfaces:**
- Consumes: enum tuples and `Status` from `@/lib/domain`; `istInputToIso`, `ISODate` from `@/lib/dates`.
- Produces:
  - `applicationSchema` (zod object); `type ApplicationInput = z.infer<typeof applicationSchema>`. Blank optional fields become `null`.
  - `roundSchema`; `type RoundInput`. `scheduled_at` takes an IST `YYYY-MM-DDTHH:mm` string and outputs UTC ISO, or `null`.
  - `withAppliedOn<T extends { status: Status; applied_on: string | null }>(input: T, today: ISODate): T`.
  - `form-state.ts`: `type FormState = { ok?: boolean; message?: string; errors?: Record<string, string[] | undefined>; values?: Record<string, string> } | undefined`; `type ActionResult = { error?: string }`.

- [ ] **Step 1: Write the failing test** in `src/lib/schemas.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { applicationSchema, roundSchema, withAppliedOn } from './schemas';

const valid = { company: 'Acme', role: 'SDE Intern', status: 'applied', apply_method: 'email', source: 'college_group' };

describe('applicationSchema', () => {
  it('accepts the quick-add fields and turns blank optional fields into null', () => {
    const r = applicationSchema.parse({ ...valid, job_url: '', notes: '   ' });
    expect(r.company).toBe('Acme');
    expect(r.job_url).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.deadline).toBeNull();
    expect(r.job_type).toBeNull();
  });

  it('requires company and role', () => {
    const r = applicationSchema.safeParse({ ...valid, company: '  ', role: '' });
    expect(r.success).toBe(false);
    expect(z.flattenError(r.error!).fieldErrors).toMatchObject({
      company: ['Company is required'],
      role: ['Role is required'],
    });
  });

  it('requires choosing how you applied and where you found it', () => {
    const r = applicationSchema.safeParse({ ...valid, apply_method: '', source: '' });
    expect(z.flattenError(r.error!).fieldErrors).toMatchObject({
      apply_method: ['Choose how you applied'],
      source: ['Choose where you found it'],
    });
  });

  it('only accepts http(s) job links', () => {
    expect(applicationSchema.safeParse({ ...valid, job_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(applicationSchema.parse({ ...valid, job_url: 'https://acme.com/jobs/1' }).job_url).toBe('https://acme.com/jobs/1');
  });

  it('rejects malformed emails and dates', () => {
    expect(applicationSchema.safeParse({ ...valid, contact_email: 'not-an-email' }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, deadline: '2026-13-40' }).success).toBe(false);
  });
});

describe('withAppliedOn', () => {
  it('clears applied_on for to_apply', () => {
    expect(withAppliedOn({ status: 'to_apply', applied_on: '2026-11-01' }, '2026-11-13').applied_on).toBeNull();
  });

  it('defaults applied_on to today once applied', () => {
    expect(withAppliedOn({ status: 'applied', applied_on: null }, '2026-11-13').applied_on).toBe('2026-11-13');
  });

  it('keeps an existing applied_on', () => {
    expect(withAppliedOn({ status: 'in_progress', applied_on: '2026-11-01' }, '2026-11-13').applied_on).toBe('2026-11-01');
  });
});

describe('roundSchema', () => {
  it('converts the IST datetime-local value to UTC ISO', () => {
    const r = roundSchema.parse({ name: 'OA', scheduled_at: '2026-11-20T10:00', result: 'upcoming', notes: '' });
    expect(r.scheduled_at).toBe('2026-11-20T04:30:00.000Z');
    expect(r.notes).toBeNull();
  });

  it('allows no time but requires a name', () => {
    expect(roundSchema.parse({ name: 'HR', scheduled_at: '', result: 'awaiting' }).scheduled_at).toBeNull();
    expect(roundSchema.safeParse({ name: ' ', result: 'upcoming' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/schemas.test.ts`
Expected: FAIL, "Failed to resolve import ./schemas".

- [ ] **Step 3: Implement `src/lib/schemas.ts`**

```ts
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
```

Create `src/lib/form-state.ts`:

```ts
export type FormState =
  | {
      ok?: boolean;
      message?: string;
      errors?: Record<string, string[] | undefined>;
      values?: Record<string, string>;
    }
  | undefined;

export type ActionResult = { error?: string };
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/lib/schemas.test.ts && npm run typecheck`
Expected: 10 tests PASS, typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts src/lib/form-state.ts
git commit -m "feat: add form validation schemas"
```

---

### Task 5: Due items and digest building

**Files:**
- Create: `src/lib/due.ts`, `src/lib/digest.ts`, `src/lib/test-fixtures.ts`
- Test: `src/lib/due.test.ts`, `src/lib/digest.test.ts`

**Interfaces:**
- Consumes: `Application`, `Round`, `Profile`, `isOpen`, `label` from `@/lib/domain`; `addDays`, `istDate`, `formatDate`, `formatDateTime`, `ISODate` from `@/lib/dates`.
- Produces (`due.ts`):
  ```ts
  type DueWindows = { roundDays: number; deadlineDays: number };
  const TODAY_WINDOWS: DueWindows;   // { roundDays: 7, deadlineDays: 7 }
  const DIGEST_WINDOWS: DueWindows;  // { roundDays: 1, deadlineDays: 2 }
  type RoundWithApp = Round & { application: Application };
  type DueItems = { overdue: Application[]; dueToday: Application[]; rounds: RoundWithApp[]; deadlines: Application[] };
  function collectDue(apps: Application[], rounds: Round[], today: ISODate, windows: DueWindows): DueItems;
  function isEmpty(items: DueItems): boolean;
  ```
  Windows are inclusive: `roundDays: 1` means the round's IST date is today or tomorrow.
- Produces (`digest.ts`):
  ```ts
  type Digest = { profile: Profile; items: DueItems };
  function buildDigests(profiles: Profile[], apps: Application[], rounds: Round[], today: ISODate): Digest[];
  function renderDigest(digest: Digest, siteUrl: string): { subject: string; text: string; html: string };
  ```
- Produces (`test-fixtures.ts`): `makeApp(patch?)`, `makeRound(patch & { application_id })`, `makeProfile(patch?)`.

- [ ] **Step 1: Create the test fixtures** in `src/lib/test-fixtures.ts`

```ts
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
```

- [ ] **Step 2: Write the failing `collectDue` test** in `src/lib/due.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { collectDue, DIGEST_WINDOWS, isEmpty } from './due';
import { makeApp, makeRound } from './test-fixtures';

const today = '2026-11-13';

describe('collectDue', () => {
  it('splits follow-ups into overdue (oldest first) and due today', () => {
    const older = makeApp({ follow_up_on: '2026-11-10' });
    const yesterday = makeApp({ follow_up_on: '2026-11-12' });
    const dueToday = makeApp({ follow_up_on: today });
    const future = makeApp({ follow_up_on: '2026-11-14' });
    const due = collectDue([yesterday, future, dueToday, older], [], today, DIGEST_WINDOWS);
    expect(due.overdue.map((a) => a.id)).toEqual([older.id, yesterday.id]);
    expect(due.dueToday.map((a) => a.id)).toEqual([dueToday.id]);
  });

  it('leaves out closed applications everywhere', () => {
    const closed = makeApp({ status: 'rejected', follow_up_on: '2026-11-12' });
    const round = makeRound({ application_id: closed.id, scheduled_at: '2026-11-13T06:00:00Z' });
    const due = collectDue([closed], [round], today, DIGEST_WINDOWS);
    expect(isEmpty(due)).toBe(true);
  });

  it('includes upcoming rounds within the window by IST date, with their application', () => {
    const app = makeApp();
    const tomorrowIst = makeRound({ application_id: app.id, scheduled_at: '2026-11-14T12:00:00Z' });
    const dayAfterIst = makeRound({ application_id: app.id, scheduled_at: '2026-11-14T18:30:00Z' }); // 15 Nov 00:00 IST
    const past = makeRound({ application_id: app.id, scheduled_at: '2026-11-12T06:00:00Z' });
    const passed = makeRound({ application_id: app.id, scheduled_at: '2026-11-13T06:00:00Z', result: 'passed' });
    const due = collectDue([app], [dayAfterIst, past, passed, tomorrowIst], today, DIGEST_WINDOWS);
    expect(due.rounds.map((r) => r.id)).toEqual([tomorrowIst.id]);
    expect(due.rounds[0].application.id).toBe(app.id);
  });

  it('includes to_apply deadlines within the window', () => {
    const inWindow = makeApp({ status: 'to_apply', deadline: '2026-11-15' });
    const tooLate = makeApp({ status: 'to_apply', deadline: '2026-11-16' });
    const passedDeadline = makeApp({ status: 'to_apply', deadline: '2026-11-12' });
    const alreadyApplied = makeApp({ status: 'applied', deadline: '2026-11-14' });
    const due = collectDue([tooLate, inWindow, passedDeadline, alreadyApplied], [], today, DIGEST_WINDOWS);
    expect(due.deadlines.map((a) => a.id)).toEqual([inWindow.id]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/due.test.ts`
Expected: FAIL, "Failed to resolve import ./due".

- [ ] **Step 4: Implement `src/lib/due.ts`**

```ts
import { addDays, istDate, type ISODate } from './dates';
import { isOpen, type Application, type Round } from './domain';

export type DueWindows = { roundDays: number; deadlineDays: number };
export const TODAY_WINDOWS: DueWindows = { roundDays: 7, deadlineDays: 7 };
export const DIGEST_WINDOWS: DueWindows = { roundDays: 1, deadlineDays: 2 };

export type RoundWithApp = Round & { application: Application };
export type DueItems = {
  overdue: Application[];
  dueToday: Application[];
  rounds: RoundWithApp[];
  deadlines: Application[];
};

const by = <T>(key: (item: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));

// ISO date strings compare correctly as plain strings.
export function collectDue(apps: Application[], rounds: Round[], today: ISODate, windows: DueWindows): DueItems {
  const open = apps.filter((a) => isOpen(a.status));
  const byId = new Map(open.map((a) => [a.id, a]));
  const roundEnd = addDays(today, windows.roundDays);
  const deadlineEnd = addDays(today, windows.deadlineDays);

  return {
    overdue: open.filter((a) => a.follow_up_on && a.follow_up_on < today).sort(by((a) => a.follow_up_on!)),
    dueToday: open.filter((a) => a.follow_up_on === today),
    rounds: rounds
      .filter((r) => {
        if (r.result !== 'upcoming' || !r.scheduled_at || !byId.has(r.application_id)) return false;
        const day = istDate(r.scheduled_at);
        return day >= today && day <= roundEnd;
      })
      .sort(by((r) => r.scheduled_at!))
      .map((r) => ({ ...r, application: byId.get(r.application_id)! })),
    deadlines: open
      .filter((a) => a.status === 'to_apply' && a.deadline && a.deadline >= today && a.deadline <= deadlineEnd)
      .sort(by((a) => a.deadline!)),
  };
}

export function isEmpty(items: DueItems): boolean {
  return !items.overdue.length && !items.dueToday.length && !items.rounds.length && !items.deadlines.length;
}
```

- [ ] **Step 5: Run the due tests**

Run: `npx vitest run src/lib/due.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 6: Write the failing digest test** in `src/lib/digest.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildDigests, renderDigest } from './digest';
import { makeApp, makeProfile, makeRound } from './test-fixtures';

const today = '2026-11-13';

describe('buildDigests', () => {
  it('groups items per user and skips users with nothing due', () => {
    const alice = makeProfile({ id: 'alice', email: 'alice@example.com' });
    const bob = makeProfile({ id: 'bob', email: 'bob@example.com' });
    const aliceApp = makeApp({ user_id: 'alice', follow_up_on: today });
    const bobApp = makeApp({ user_id: 'bob', follow_up_on: '2026-11-20' });
    const digests = buildDigests([alice, bob], [aliceApp, bobApp], [], today);
    expect(digests).toHaveLength(1);
    expect(digests[0].profile.id).toBe('alice');
    expect(digests[0].items.dueToday.map((a) => a.id)).toEqual([aliceApp.id]);
  });

  it('only uses rounds that belong to the same user', () => {
    const alice = makeProfile({ id: 'alice' });
    const aliceApp = makeApp({ user_id: 'alice' });
    const round = makeRound({ application_id: aliceApp.id, user_id: 'alice', scheduled_at: '2026-11-13T06:00:00Z' });
    const [digest] = buildDigests([alice], [aliceApp], [round], today);
    expect(digest.items.rounds.map((r) => r.id)).toEqual([round.id]);
  });

  it('skips users who turned the digest off or already got one today', () => {
    const off = makeProfile({ id: 'off', digest_enabled: false });
    const done = makeProfile({ id: 'done', last_digest_on: today });
    const due = makeProfile({ id: 'due', last_digest_on: '2026-11-12' });
    const apps = ['off', 'done', 'due'].map((user_id) => makeApp({ user_id, follow_up_on: today }));
    expect(buildDigests([off, done, due], apps, [], today).map((d) => d.profile.id)).toEqual(['due']);
  });
});

describe('renderDigest', () => {
  const profile = makeProfile();

  it('counts items in the subject', () => {
    const one = makeApp({ follow_up_on: today });
    const [digest] = buildDigests([profile], [one], [], today);
    expect(renderDigest(digest, 'https://x.test').subject).toBe('Job tracker: 1 thing to check today');
    const [two] = buildDigests([profile], [one, makeApp({ follow_up_on: '2026-11-01' })], [], today);
    expect(renderDigest(two, 'https://x.test').subject).toBe('Job tracker: 2 things to check today');
  });

  it('links each item to its application page', () => {
    const app = makeApp({ follow_up_on: today });
    const [digest] = buildDigests([profile], [app], [], today);
    const { text, html } = renderDigest(digest, 'https://x.test');
    expect(text).toContain(`https://x.test/applications/${app.id}`);
    expect(html).toContain(`href="https://x.test/applications/${app.id}"`);
  });

  it('escapes HTML in user-entered text', () => {
    const app = makeApp({ company: '<script>alert(1)</script>', follow_up_on: today });
    const [digest] = buildDigests([profile], [app], [], today);
    const { html } = renderDigest(digest, 'https://x.test');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/lib/digest.test.ts`
Expected: FAIL, "Failed to resolve import ./digest".

- [ ] **Step 8: Implement `src/lib/digest.ts`**

```ts
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
```

- [ ] **Step 9: Run all tests**

Run: `npm test`
Expected: every test in dates, follow-up, schemas, due and digest PASSES.

- [ ] **Step 10: Commit**

```bash
git add src/lib/due.ts src/lib/due.test.ts src/lib/digest.ts src/lib/digest.test.ts src/lib/test-fixtures.ts
git commit -m "feat: add due-item collection and digest rendering"
```

---

### Task 6: Provision Supabase, Google sign-in and the database schema

This task needs the user in a browser. **Confirm with the user before creating cloud resources.** Secrets are typed by the user with `! <command>`, never pasted into chat.

**Files:**
- Create: `supabase/migrations/20261113000000_init.sql`
- Create (generated, gitignored): `.env.local`, `.vercel/`

**Interfaces:**
- Produces: tables `profiles`, `applications` and `rounds` matching the types in `src/lib/domain.ts`; a trigger that creates a profile on sign-up; RLS policies; `.env.local` containing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `POSTGRES_URL_NON_POOLING`.

- [ ] **Step 1: Write the migration** in `supabase/migrations/20261113000000_init.sql`

```sql
create type public.application_status as enum ('to_apply', 'applied', 'in_progress', 'offer', 'rejected', 'ghosted', 'withdrawn');
create type public.apply_method as enum ('email', 'form', 'portal', 'referral', 'other');
create type public.job_source as enum ('college_group', 'linkedin', 'company_site', 'job_board', 'friend', 'other');
create type public.job_type as enum ('internship', 'full_time', 'contract');
create type public.round_result as enum ('upcoming', 'passed', 'failed', 'awaiting');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  digest_enabled boolean not null default true,
  last_digest_on date
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  company text not null check (char_length(company) between 1 and 200),
  role text not null check (char_length(role) between 1 and 200),
  status public.application_status not null default 'applied',
  apply_method public.apply_method not null,
  source public.job_source not null,
  source_detail text,
  job_url text,
  contact_email text,
  resume_version text,
  job_type public.job_type,
  location text,
  salary text,
  deadline date,
  applied_on date,
  follow_up_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_user_follow_up_idx on public.applications (user_id, follow_up_on);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  scheduled_at timestamptz,
  result public.round_result not null default 'upcoming',
  notes text,
  created_at timestamptz not null default now()
);
create index rounds_application_idx on public.rounds (application_id);
create index rounds_user_idx on public.rounds (user_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.rounds enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "applications: own rows" on public.applications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The extra check stops a user attaching a round to someone else's application.
create policy "rounds: own rows" on public.rounds
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.applications, public.rounds to authenticated;
```

- [ ] **Step 2: Link a Vercel project and add Supabase (USER: confirm first)**

```bash
vercel link --yes --project job-tracker
```

Then the user runs this interactive command in the prompt:

```
! vercel integration add supabase
```

It creates a Supabase project linked to the Vercel project and sets its env vars. Then pull them:

```bash
vercel env pull .env.local --yes
grep -oE '^[A-Z_]+' .env.local | sort
```

Expected: the list includes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `POSTGRES_URL_NON_POOLING`. If the integration uses different names (for example `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), stop and tell the user. Do not rename variables in code without asking.

- [ ] **Step 3: Apply the migration**

```bash
set -a; source .env.local; set +a
npx supabase db push --db-url "$POSTGRES_URL_NON_POOLING"
```

Expected: "Applying migration 20261113000000_init.sql... Finished supabase db push." If the CLI fails, the user pastes the migration file into the Supabase dashboard's SQL Editor and runs it.

- [ ] **Step 4: Verify the tables exist and RLS hides rows from anonymous requests**

```bash
node --env-file=.env.local -e "fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/applications?select=id', { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }).then(r => r.text()).then(console.log)"
```

Expected: `[]` (an error such as `relation ... does not exist` means the migration did not apply).

- [ ] **Step 5: Set up Google sign-in (USER, in the browser)**

1. Google Cloud Console → APIs & Services → OAuth consent screen: create an External app with scopes `email`, `profile` and `openid`, then click **Publish app** so friends can sign in. Basic scopes need no Google review.
2. Credentials → Create credentials → OAuth client ID → Web application. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (the Supabase URL from `.env.local` + `/auth/v1/callback`).
3. Supabase dashboard → Authentication → Sign In / Providers → Google: enable it, paste the client ID and secret, and save.
4. Supabase → Authentication → URL Configuration: set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to Redirect URLs.

- [ ] **Step 6: Add the email and cron secrets locally (USER)**

The Gmail account needs 2-Step Verification. Create an app password at https://myaccount.google.com/apppasswords, then append it to `.env.local` with an editor (not in chat):

```
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
CRON_SECRET=<output of: openssl rand -hex 32>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261113000000_init.sql
git commit -m "feat: add database schema with row-level security"
```

---

### Task 7: Auth, app shell and settings

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/login/google-button.tsx`, `src/app/auth/callback/route.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/actions/settings.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces:
  - `createClient(): Promise<SupabaseClient>` and `requireUser(): Promise<{ supabase; user }>` from `@/lib/supabase/server`. `requireUser` redirects to `/login` when signed out.
  - `createClient()` from `@/lib/supabase/client` (browser).
  - `createAdminClient()` from `@/lib/supabase/admin` (service role, server-only).
  - `type ServerSupabase = Awaited<ReturnType<typeof createClient>>` from `@/lib/supabase/server`.
  - Server actions `setDigest(formData)` and `signOut()`.

- [ ] **Step 1: Supabase clients**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
```

`src/lib/supabase/server.ts`:

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}
```

`src/lib/supabase/admin.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Bypasses RLS. Only the digest cron route may use this.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 2: Proxy (session refresh + redirect)** in `src/proxy.ts`

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // The cron route has its own secret check.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/cron).*)'],
};
```

- [ ] **Step 3: Login page and OAuth callback**

`src/app/login/google-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function GoogleButton() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setPending(false);
      toast.error(error.message);
    }
  }

  return (
    <Button className="w-full" onClick={signIn} disabled={pending}>
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  );
}
```

`src/app/login/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GoogleButton } from './google-button';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/');

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Job Tracker</h1>
          <p className="text-muted-foreground">Every application, round and follow-up in one place.</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Sign-in failed. Please try again.
          </p>
        )}
        <GoogleButton />
      </div>
    </main>
  );
}
```

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 4: Root layout: title and toaster**

In `src/app/layout.tsx`:
- Replace the generated `metadata` export with `export const metadata: Metadata = { title: 'Job Tracker', description: 'Track job applications and follow-ups' };`.
- Add `import { Toaster } from '@/components/ui/sonner';`.
- Render `<Toaster richColors />` right after `{children}` inside `<body>`.

Keep the generated font setup as it is.

- [ ] **Step 5: App shell and error boundary**

`src/app/(app)/layout.tsx`:

```tsx
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-lg font-semibold">
          Job Tracker
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">Today</Link>
          <Link href="/applications" className="hover:underline">Applications</Link>
          <Link href="/settings" className="hover:underline">Settings</Link>
          <Link href="/applications/new" className={buttonVariants({ size: 'sm' })}>
            + New
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

`src/app/(app)/error.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

- [ ] **Step 6: Settings actions and page**

`src/app/actions/settings.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function setDigest(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('profiles')
    .update({ digest_enabled: formData.get('enabled') === 'true' })
    .eq('id', user.id);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

`src/app/(app)/settings/page.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { setDigest, signOut } from '@/app/actions/settings';
import type { Profile } from '@/lib/domain';
import { requireUser } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw new Error(error.message);
  const profile = data as Profile;

  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="space-y-2">
        <h2 className="font-medium">Daily digest</h2>
        <p className="text-sm text-muted-foreground">
          {profile.digest_enabled
            ? `On. On days when something is due, a summary goes to ${profile.email} between 8 and 9 AM IST.`
            : 'Off. You will not get reminder emails.'}
        </p>
        <form action={setDigest}>
          <input type="hidden" name="enabled" value={String(!profile.digest_enabled)} />
          <Button type="submit" variant="outline">
            {profile.digest_enabled ? 'Turn off digest' : 'Turn on digest'}
          </Button>
        </form>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Account</h2>
        <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        <form action={signOut}>
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 8: Manual check**

Run `npm run dev`, then:
1. Open http://localhost:3000/settings and confirm it redirects to `/login`.
2. Click "Continue with Google" and sign in. You land on `/`, which is a 404 until Task 11. That is expected.
3. Open `/settings`: your email shows and the digest is on. Toggle it off and on.
4. Click Sign out and confirm you are back on `/login`.
5. In Supabase → Table Editor → `profiles`, confirm one row with your email.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase src/proxy.ts src/app/login src/app/auth src/app/layout.tsx "src/app/(app)/layout.tsx" "src/app/(app)/error.tsx" "src/app/(app)/settings" src/app/actions/settings.ts
git commit -m "feat: add Google sign-in, app shell and settings"
```

---

### Task 8: Create, edit and delete applications

**Files:**
- Create: `src/lib/follow-up-db.ts`, `src/app/actions/applications.ts`, `src/components/form-controls.tsx`, `src/components/application-form.tsx`, `src/components/delete-application-button.tsx`, `src/app/(app)/applications/new/page.tsx`, `src/app/(app)/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: `requireUser`, `ServerSupabase` (Task 7); `applicationSchema`, `withAppliedOn`, `FormState`, `ActionResult` (Task 4); `suggestFollowUp`, `FollowUpEvent` (Task 3); `istDate`, `addDays` (Task 2).
- Produces:
  - `updateWithFollowUp(supabase: ServerSupabase, id: string, event: FollowUpEvent, makePatch?: (app: Application) => Partial<Application>): Promise<string | null>` (returns an error message or null).
  - Server actions:
    - `createApplication(prev: FormState, formData: FormData): Promise<FormState>`
    - `updateApplication(id: string, prev: FormState, formData: FormData): Promise<FormState>`
    - `deleteApplication(id: string): Promise<void>`
    - `setStatus(id: string, status: string): Promise<ActionResult>`
    - `checkApplication(id: string): Promise<ActionResult>`
    - `snoozeApplication(id: string, days: number): Promise<ActionResult>`
  - Components:
    - `NativeSelect` (props: `options: readonly string[]`, `placeholder?`, plus all `<select>` props)
    - `Field` (props: `label`, `htmlFor`, `errors?`, `className?`, `children`)
    - `selectClass` (string)
    - `<ApplicationForm application?: Application & { rounds: Round[] } />`
    - `<DeleteApplicationButton id />`

- [ ] **Step 1: Shared follow-up DB helper** in `src/lib/follow-up-db.ts`

```ts
import 'server-only';
import { istDate } from './dates';
import type { Application, Round } from './domain';
import { suggestFollowUp, type FollowUpEvent } from './follow-up';
import type { ServerSupabase } from './supabase/server';

// Loads the application with its rounds, applies the patch, and saves it with the suggested follow-up date.
export async function updateWithFollowUp(
  supabase: ServerSupabase,
  id: string,
  event: FollowUpEvent,
  makePatch: (app: Application) => Partial<Application> = () => ({}),
): Promise<string | null> {
  const { data, error } = await supabase.from('applications').select('*, rounds(*)').eq('id', id).single();
  if (error) return error.message;
  const app = data as Application & { rounds: Round[] };
  const patch = makePatch(app);
  const follow_up_on = suggestFollowUp({ ...app, ...patch }, event, istDate());
  const { error: saveError } = await supabase.from('applications').update({ ...patch, follow_up_on }).eq('id', id);
  return saveError?.message ?? null;
}
```

- [ ] **Step 2: Application server actions** in `src/app/actions/applications.ts`

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { addDays, istDate } from '@/lib/dates';
import { STATUSES } from '@/lib/domain';
import { updateWithFollowUp } from '@/lib/follow-up-db';
import type { ActionResult, FormState } from '@/lib/form-state';
import { applicationSchema, withAppliedOn } from '@/lib/schemas';
import { requireUser } from '@/lib/supabase/server';

function parseApplicationForm(formData: FormData) {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const result = applicationSchema.safeParse(values);
  if (!result.success) return { values, errors: z.flattenError(result.error).fieldErrors };
  return { values, data: withAppliedOn(result.data, istDate()) };
}

export async function createApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const parsed = parseApplicationForm(formData);
  if ('errors' in parsed) return { errors: parsed.errors, values: parsed.values };
  const { data, error } = await supabase.from('applications').insert(parsed.data).select('id').single();
  if (error) return { message: error.message, values: parsed.values };
  revalidatePath('/', 'layout');
  redirect(`/applications/${data.id}`);
}

export async function updateApplication(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const parsed = parseApplicationForm(formData);
  if ('errors' in parsed) return { errors: parsed.errors, values: parsed.values };
  const { error } = await supabase.from('applications').update(parsed.data).eq('id', id);
  if (error) return { message: error.message, values: parsed.values };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved' };
}

export async function deleteApplication(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
  redirect('/applications');
}

export async function setStatus(id: string, status: string): Promise<ActionResult> {
  const parsed = z.enum(STATUSES).safeParse(status);
  if (!parsed.success) return { error: 'Invalid status' };
  const { supabase } = await requireUser();
  const error = await updateWithFollowUp(supabase, id, 'status_changed', (app) =>
    withAppliedOn({ status: parsed.data, applied_on: app.applied_on }, istDate()),
  );
  if (error) return { error };
  revalidatePath('/', 'layout');
  return {};
}

export async function checkApplication(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const error = await updateWithFollowUp(supabase, id, 'checked');
  if (error) return { error };
  revalidatePath('/', 'layout');
  return {};
}

export async function snoozeApplication(id: string, days: number): Promise<ActionResult> {
  if (![1, 3, 7].includes(days)) return { error: 'Invalid snooze' };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('applications')
    .update({ follow_up_on: addDays(istDate(), days) })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return {};
}
```

- [ ] **Step 3: Form controls** in `src/components/form-controls.tsx`

```tsx
import type { ComponentProps, ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { label } from '@/lib/domain';
import { cn } from '@/lib/utils';

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50';

export function NativeSelect({
  options,
  placeholder,
  className,
  ...props
}: ComponentProps<'select'> & { options: readonly string[]; placeholder?: string }) {
  return (
    <select className={cn(selectClass, className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

export function Field({
  label: text,
  htmlFor,
  errors,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{text}</Label>
      {children}
      {errors?.[0] && <p className="text-sm text-destructive">{errors[0]}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Application form** in `src/components/application-form.tsx`

```tsx
'use client';

import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createApplication, updateApplication } from '@/app/actions/applications';
import { Field, NativeSelect } from '@/components/form-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { istDate } from '@/lib/dates';
import { APPLY_METHODS, JOB_TYPES, SOURCES, STATUSES, type Application, type Round, type Status } from '@/lib/domain';
import { suggestFollowUp } from '@/lib/follow-up';

type Tracked = { status: Status; appliedOn: string; deadline: string };

export function ApplicationForm({ application }: { application?: Application & { rounds: Round[] } }) {
  const isNew = !application;
  const [state, formAction, pending] = useActionState(
    isNew ? createApplication : updateApplication.bind(null, application.id),
    undefined,
  );
  const today = istDate();

  // Status and the dates it depends on are controlled so the follow-up suggestion updates as they change.
  const [tracked, setTracked] = useState<Tracked>({
    status: application?.status ?? 'applied',
    appliedOn: application?.applied_on ?? today,
    deadline: application?.deadline ?? '',
  });
  const suggest = (t: Tracked) =>
    suggestFollowUp(
      { status: t.status, applied_on: t.appliedOn || null, deadline: t.deadline || null, rounds: application?.rounds ?? [] },
      isNew ? 'created' : 'status_changed',
      today,
    ) ?? '';
  const [followUp, setFollowUp] = useState(isNew ? suggest(tracked) : (application.follow_up_on ?? ''));

  function track(patch: Partial<Tracked>) {
    const next = { ...tracked, ...patch };
    setTracked(next);
    setFollowUp(suggest(next));
  }

  useEffect(() => {
    if (state?.ok) toast.success('Saved');
    else if (state?.message) toast.error(state.message);
  }, [state]);

  // After a failed submit, show what the user typed rather than the saved value.
  const value = (key: keyof Application) => state?.values?.[key] ?? String(application?.[key] ?? '');
  const errors = (key: string) => state?.errors?.[key];

  const deadlineField = (
    <Field label="Deadline" htmlFor="deadline" errors={errors('deadline')}>
      <Input id="deadline" name="deadline" type="date" value={tracked.deadline} onChange={(e) => track({ deadline: e.target.value })} />
    </Field>
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="company" errors={errors('company')}>
          <Input id="company" name="company" required defaultValue={value('company')} />
        </Field>
        <Field label="Role" htmlFor="role" errors={errors('role')}>
          <Input id="role" name="role" required defaultValue={value('role')} />
        </Field>
        <Field label="How you applied" htmlFor="apply_method" errors={errors('apply_method')}>
          <NativeSelect id="apply_method" name="apply_method" required options={APPLY_METHODS} placeholder="Choose…" defaultValue={value('apply_method')} />
        </Field>
        <Field label="Where you found it" htmlFor="source" errors={errors('source')}>
          <NativeSelect id="source" name="source" required options={SOURCES} placeholder="Choose…" defaultValue={value('source')} />
        </Field>
        <Field label="Status" htmlFor="status" errors={errors('status')}>
          <NativeSelect id="status" name="status" options={STATUSES} value={tracked.status} onChange={(e) => track({ status: e.target.value as Status })} />
        </Field>
        {tracked.status === 'to_apply' ? (
          deadlineField
        ) : (
          <Field label="Applied on" htmlFor="applied_on" errors={errors('applied_on')}>
            <Input id="applied_on" name="applied_on" type="date" value={tracked.appliedOn} onChange={(e) => track({ appliedOn: e.target.value })} />
          </Field>
        )}
        <Field label="Follow up on" htmlFor="follow_up_on" errors={errors('follow_up_on')}>
          <Input id="follow_up_on" name="follow_up_on" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </Field>
      </div>

      <details open={!isNew || !!state?.errors} className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">More details</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {tracked.status !== 'to_apply' && deadlineField}
          <Field label="Source detail" htmlFor="source_detail" errors={errors('source_detail')}>
            <Input id="source_detail" name="source_detail" placeholder="e.g. CSE 2026 WhatsApp group" defaultValue={value('source_detail')} />
          </Field>
          <Field label="Job link" htmlFor="job_url" errors={errors('job_url')}>
            <Input id="job_url" name="job_url" type="url" placeholder="https://" defaultValue={value('job_url')} />
          </Field>
          <Field label="Contact email" htmlFor="contact_email" errors={errors('contact_email')}>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={value('contact_email')} />
          </Field>
          <Field label="Resume version" htmlFor="resume_version" errors={errors('resume_version')}>
            <Input id="resume_version" name="resume_version" placeholder="e.g. SDE v3" defaultValue={value('resume_version')} />
          </Field>
          <Field label="Job type" htmlFor="job_type" errors={errors('job_type')}>
            <NativeSelect id="job_type" name="job_type" options={JOB_TYPES} placeholder="—" defaultValue={value('job_type')} />
          </Field>
          <Field label="Location" htmlFor="location" errors={errors('location')}>
            <Input id="location" name="location" placeholder="e.g. Bangalore / Remote" defaultValue={value('location')} />
          </Field>
          <Field label="Salary / stipend" htmlFor="salary" errors={errors('salary')}>
            <Input id="salary" name="salary" placeholder="e.g. 12 LPA" defaultValue={value('salary')} />
          </Field>
          <Field label="Notes" htmlFor="notes" errors={errors('notes')} className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={4} defaultValue={value('notes')} />
          </Field>
        </div>
      </details>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? 'Saving…' : isNew ? 'Add application' : 'Save changes'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Delete button** in `src/components/delete-application-button.tsx`

```tsx
'use client';

import { deleteApplication } from '@/app/actions/applications';
import { Button } from '@/components/ui/button';

export function DeleteApplicationButton({ id }: { id: string }) {
  return (
    <form
      action={deleteApplication.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm('Delete this application and all its rounds?')) e.preventDefault();
      }}
    >
      <Button type="submit" variant="destructive">
        Delete application
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: New and detail pages**

`src/app/(app)/applications/new/page.tsx`:

```tsx
import { ApplicationForm } from '@/components/application-form';

export default function NewApplicationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New application</h1>
      <ApplicationForm />
    </div>
  );
}
```

`src/app/(app)/applications/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ApplicationForm } from '@/components/application-form';
import { DeleteApplicationButton } from '@/components/delete-application-button';
import type { Application, Round } from '@/lib/domain';
import { requireUser } from '@/lib/supabase/server';

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from('applications').select('*, rounds(*)').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const app = data as Application & { rounds: Round[] };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{app.company}</h1>
          <p className="text-muted-foreground">{app.role}</p>
        </div>
        {app.job_url && (
          <a href={app.job_url} target="_blank" rel="noreferrer" className="text-sm underline">
            Open posting
          </a>
        )}
      </div>
      <ApplicationForm application={app} />
      <DeleteApplicationButton id={app.id} />
    </div>
  );
}
```

- [ ] **Step 7: Typecheck, lint and tests**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all exit 0.

- [ ] **Step 8: Manual check** (`npm run dev`, signed in)

1. Open `/applications/new`. The follow-up date is pre-filled with today + 7.
2. Submit with company blank: the browser blocks it (`required`). Remove `required` in devtools and submit again: "Company is required" shows and the other fields keep what you typed.
3. Change the status to "To apply": "Applied on" is replaced by "Deadline". Pick a deadline and the follow-up becomes the day before.
4. Save. You land on `/applications/<id>`. Edit the role, save, and the toast says "Saved".
5. Enter `javascript:alert(1)` as the job link and save: "Enter a valid http(s) link" shows.
6. Click Delete and cancel the dialog (nothing happens). Click Delete and confirm: you are redirected to `/applications`, which 404s until Task 10. That is expected.

- [ ] **Step 9: Commit**

```bash
git add src/lib/follow-up-db.ts src/app/actions/applications.ts src/components/form-controls.tsx src/components/application-form.tsx src/components/delete-application-button.tsx "src/app/(app)/applications"
git commit -m "feat: add, edit and delete applications"
```

---

### Task 9: Rounds

**Files:**
- Create: `src/app/actions/rounds.ts`, `src/components/round-list.tsx`
- Modify: `src/app/(app)/applications/[id]/page.tsx` (render `RoundList`)

**Interfaces:**
- Consumes: `roundSchema`, `FormState`, `ActionResult`, `updateWithFollowUp`, `requireUser`, `isoToIstInput`, `formatDateTime`, `label`.
- Produces:
  - Server actions `saveRound(applicationId: string, roundId: string | null, prev: FormState, formData: FormData): Promise<FormState>` and `deleteRound(applicationId: string, roundId: string): Promise<ActionResult>`.
  - `<RoundList applicationId rounds />`.

- [ ] **Step 1: Round actions** in `src/app/actions/rounds.ts`

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { updateWithFollowUp } from '@/lib/follow-up-db';
import type { ActionResult, FormState } from '@/lib/form-state';
import { roundSchema } from '@/lib/schemas';
import { requireUser } from '@/lib/supabase/server';

export async function saveRound(
  applicationId: string,
  roundId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const values = Object.fromEntries(formData) as Record<string, string>;
  const result = roundSchema.safeParse(values);
  if (!result.success) return { errors: z.flattenError(result.error).fieldErrors, values };

  const { error } = roundId
    ? await supabase.from('rounds').update(result.data).eq('id', roundId)
    : await supabase.from('rounds').insert({ ...result.data, application_id: applicationId });
  if (error) return { message: error.message, values };

  const followUpError = await updateWithFollowUp(supabase, applicationId, 'round_saved');
  if (followUpError) return { message: `Round saved, but the follow-up date was not updated: ${followUpError}` };

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteRound(applicationId: string, roundId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('rounds').delete().eq('id', roundId).eq('application_id', applicationId);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return {};
}
```

- [ ] **Step 2: Round list** in `src/components/round-list.tsx`

```tsx
'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteRound, saveRound } from '@/app/actions/rounds';
import { Field, NativeSelect } from '@/components/form-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, isoToIstInput } from '@/lib/dates';
import { label, ROUND_RESULTS, type Round } from '@/lib/domain';

export function RoundList({ applicationId, rounds }: { applicationId: string; rounds: Round[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sorted = [...rounds].sort((a, b) => (a.scheduled_at ?? '9999').localeCompare(b.scheduled_at ?? '9999'));

  function remove(round: Round) {
    if (!confirm(`Delete round "${round.name}"?`)) return;
    startTransition(async () => {
      const { error } = await deleteRound(applicationId, round.id);
      if (error) toast.error(error);
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Rounds</h2>
      {sorted.length === 0 && <p className="text-sm text-muted-foreground">No rounds yet.</p>}
      <ol className="space-y-2 border-l pl-4">
        {sorted.map((round) =>
          editing === round.id ? (
            <li key={round.id}>
              <RoundForm applicationId={applicationId} round={round} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={round.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{round.name}</span>{' '}
                  <Badge variant="secondary">{label(round.result)}</Badge>
                  {round.scheduled_at && <p className="text-sm text-muted-foreground">{formatDateTime(round.scheduled_at)}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(round.id)}>Edit</Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(round)}>Delete</Button>
                </div>
              </div>
              {round.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{round.notes}</p>}
            </li>
          ),
        )}
      </ol>
      <RoundForm applicationId={applicationId} />
    </section>
  );
}

function RoundForm({ applicationId, round, onDone }: { applicationId: string; round?: Round; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(saveRound.bind(null, applicationId, round?.id ?? null), undefined);
  const prefix = round?.id ?? 'new';

  useEffect(() => {
    if (state?.ok) onDone?.();
    else if (state?.message) toast.error(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to a new action result; onDone is a fresh arrow each render
  }, [state]);

  const value = (key: 'name' | 'result' | 'notes') => state?.values?.[key] ?? round?.[key] ?? '';
  const scheduled = state?.values?.scheduled_at ?? (round?.scheduled_at ? isoToIstInput(round.scheduled_at) : '');

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
      <Field label="Round" htmlFor={`${prefix}-name`} errors={state?.errors?.name}>
        <Input id={`${prefix}-name`} name="name" required placeholder="e.g. OA, Tech 1, HR" defaultValue={value('name')} />
      </Field>
      <Field label="When (IST)" htmlFor={`${prefix}-scheduled_at`} errors={state?.errors?.scheduled_at}>
        <Input id={`${prefix}-scheduled_at`} name="scheduled_at" type="datetime-local" defaultValue={scheduled} />
      </Field>
      <Field label="Result" htmlFor={`${prefix}-result`} errors={state?.errors?.result}>
        <NativeSelect id={`${prefix}-result`} name="result" options={ROUND_RESULTS} defaultValue={value('result') || 'upcoming'} />
      </Field>
      <Field label="Notes" htmlFor={`${prefix}-notes`} errors={state?.errors?.notes} className="sm:col-span-3">
        <Textarea id={`${prefix}-notes`} name="notes" rows={2} defaultValue={value('notes')} />
      </Field>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : round ? 'Save round' : 'Add round'}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Render rounds on the detail page**

In `src/app/(app)/applications/[id]/page.tsx`, add `import { RoundList } from '@/components/round-list';` and render `<RoundList applicationId={app.id} rounds={app.rounds} />` between `<ApplicationForm application={app} />` and `<DeleteApplicationButton id={app.id} />`.

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Manual check** (`npm run dev`)

1. On an application, add a round "OA" for tomorrow at 10:00. It appears in the list with the time in IST, and after a refresh the follow-up field shows the day after the OA.
2. Edit it and set the result to Passed. The follow-up changes to today + 7 for applied (or today + 5 for in progress).
3. Add a round without a time: it is listed last.
4. Delete a round after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/rounds.ts src/components/round-list.tsx "src/app/(app)/applications/[id]/page.tsx"
git commit -m "feat: track interview rounds per application"
```

---

### Task 10: Applications list

**Files:**
- Create: `src/components/status-select.tsx`, `src/app/(app)/applications/page.tsx`

**Interfaces:**
- Consumes: `setStatus` (Task 8), `NativeSelect` and `selectClass` (Task 8), `requireUser`, `formatDate`, `label`, `STATUSES`, `SOURCES`.
- Produces: `<StatusSelect id status />`.

- [ ] **Step 1: Inline status select** in `src/components/status-select.tsx`

```tsx
'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { setStatus } from '@/app/actions/applications';
import { NativeSelect } from '@/components/form-controls';
import { STATUSES, type Status } from '@/lib/domain';

export function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      key={status}
      aria-label="Status"
      className="h-8 w-auto"
      options={STATUSES}
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const { error } = await setStatus(id, next);
          if (error) toast.error(error);
        });
      }}
    />
  );
}
```

- [ ] **Step 2: List page** in `src/app/(app)/applications/page.tsx`

```tsx
import Link from 'next/link';
import { NativeSelect, selectClass } from '@/components/form-controls';
import { StatusSelect } from '@/components/status-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/dates';
import { label, SOURCES, STATUSES, type Application } from '@/lib/domain';
import { requireUser } from '@/lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return typeof v === 'string' ? v : '';
  };
  const q = get('q');
  const status = get('status');
  const source = get('source');
  const sort = get('sort') === 'follow_up' ? 'follow_up' : 'applied';

  const { supabase } = await requireUser();
  let query = supabase.from('applications').select('*');
  if ((STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
  if ((SOURCES as readonly string[]).includes(source)) query = query.eq('source', source);
  query =
    sort === 'follow_up'
      ? query.order('follow_up_on', { ascending: true, nullsFirst: false })
      : query.order('applied_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Search runs in JS so user text never goes into a PostgREST filter string.
  const needle = q.trim().toLowerCase();
  const apps = (data as Application[]).filter(
    (a) => !needle || a.company.toLowerCase().includes(needle) || a.role.toLowerCase().includes(needle),
  );
  const date = (d: string | null) => (d ? formatDate(d) : '—');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Applications</h1>
      <form role="search" className="flex flex-wrap gap-2">
        <Input name="q" aria-label="Search" placeholder="Search company or role" defaultValue={q} className="w-full sm:w-56" />
        <NativeSelect name="status" aria-label="Filter by status" options={STATUSES} placeholder="All statuses" defaultValue={status} className="w-auto" />
        <NativeSelect name="source" aria-label="Filter by source" options={SOURCES} placeholder="All sources" defaultValue={source} className="w-auto" />
        <select name="sort" aria-label="Sort" defaultValue={sort} className={`${selectClass} w-auto`}>
          <option value="applied">Newest applied</option>
          <option value="follow_up">Next follow-up</option>
        </select>
        <Button type="submit" variant="outline">Apply</Button>
      </form>

      {apps.length === 0 ? (
        <p className="text-muted-foreground">
          No applications found. <Link href="/applications/new" className="underline">Add one</Link>
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Follow up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/applications/${a.id}`} className="font-medium hover:underline">{a.company}</Link>
                    </TableCell>
                    <TableCell>{a.role}</TableCell>
                    <TableCell><StatusSelect id={a.id} status={a.status} /></TableCell>
                    <TableCell>{label(a.source)}</TableCell>
                    <TableCell>{date(a.applied_on)}</TableCell>
                    <TableCell>{date(a.follow_up_on)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-2 md:hidden">
            {apps.map((a) => (
              <li key={a.id} className="space-y-2 rounded-lg border p-3">
                <div>
                  <Link href={`/applications/${a.id}`} className="font-medium hover:underline">{a.company}</Link>
                  <p className="text-sm text-muted-foreground">
                    {a.role} · {label(a.source)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <StatusSelect id={a.id} status={a.status} />
                  <span className="text-muted-foreground">Follow up: {date(a.follow_up_on)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Manual check** (`npm run dev`, with at least 3 applications)

1. `/applications` lists them. Narrow the window below 768px to see cards.
2. Search for part of a company name and click Apply: only matching rows remain. Search for `a,b)` and confirm it doesn't crash.
3. Filter by status, then by source. Sort by "Next follow-up": rows without a follow-up date come last.
4. Change a status inline to Rejected, reload, and confirm it stuck and the follow-up shows "—".

- [ ] **Step 5: Commit**

```bash
git add src/components/status-select.tsx "src/app/(app)/applications/page.tsx"
git commit -m "feat: list, search and filter applications"
```

---

### Task 11: Today page

**Files:**
- Create: `src/components/today-item.tsx`, `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `collectDue`, `isEmpty`, `TODAY_WINDOWS` (Task 5); `checkApplication`, `snoozeApplication` (Task 8); `StatusSelect` (Task 10); `istDate`, `formatDate`, `formatDateTime`.
- Produces: `<TodayItem app>{meta}</TodayItem>`.

- [ ] **Step 1: Today row** in `src/components/today-item.tsx`

```tsx
'use client';

import Link from 'next/link';
import { useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { checkApplication, snoozeApplication } from '@/app/actions/applications';
import { StatusSelect } from '@/components/status-select';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/form-state';
import type { Application } from '@/lib/domain';

export function TodayItem({ app, children }: { app: Application; children?: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const { error } = await action();
      if (error) toast.error(error);
    });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <Link href={`/applications/${app.id}`} className="font-medium hover:underline">{app.company}</Link>
        <p className="text-sm text-muted-foreground">
          {app.role}
          {children}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" disabled={pending} onClick={() => run(() => checkApplication(app.id))}>Checked</Button>
        {[1, 3, 7].map((days) => (
          <Button
            key={days}
            size="sm"
            variant="outline"
            disabled={pending}
            aria-label={`Snooze ${days} day${days > 1 ? 's' : ''}`}
            onClick={() => run(() => snoozeApplication(app.id, days))}
          >
            +{days}d
          </Button>
        ))}
        <StatusSelect id={app.id} status={app.status} />
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Today page** in `src/app/(app)/page.tsx`

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TodayItem } from '@/components/today-item';
import { formatDate, formatDateTime, istDate } from '@/lib/dates';
import type { Application, Round } from '@/lib/domain';
import { collectDue, isEmpty, TODAY_WINDOWS } from '@/lib/due';
import { requireUser } from '@/lib/supabase/server';

export default async function TodayPage() {
  const { supabase } = await requireUser();
  const [apps, rounds] = await Promise.all([
    supabase.from('applications').select('*'),
    supabase.from('rounds').select('*'),
  ]);
  if (apps.error) throw new Error(apps.error.message);
  if (rounds.error) throw new Error(rounds.error.message);
  const due = collectDue(apps.data as Application[], rounds.data as Round[], istDate(), TODAY_WINDOWS);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Today</h1>
      {isEmpty(due) && (
        <p className="text-muted-foreground">
          Nothing to check today. <Link href="/applications/new" className="underline">Add an application</Link>
        </p>
      )}
      <Section title="Overdue" count={due.overdue.length}>
        {due.overdue.map((a) => (
          <TodayItem key={a.id} app={a}> · was due {formatDate(a.follow_up_on!)}</TodayItem>
        ))}
      </Section>
      <Section title="Due today" count={due.dueToday.length}>
        {due.dueToday.map((a) => <TodayItem key={a.id} app={a} />)}
      </Section>
      <Section title="Rounds in the next 7 days" count={due.rounds.length}>
        {due.rounds.map((r) => (
          <li key={r.id} className="rounded-lg border p-3">
            <Link href={`/applications/${r.application_id}`} className="font-medium hover:underline">
              {r.application.company}: {r.name}
            </Link>
            <p className="text-sm text-muted-foreground">{formatDateTime(r.scheduled_at!)}</p>
          </li>
        ))}
      </Section>
      <Section title="Deadlines in the next 7 days" count={due.deadlines.length}>
        {due.deadlines.map((a) => (
          <TodayItem key={a.id} app={a}> · deadline {formatDate(a.deadline!)}</TodayItem>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">
        {title} <span className="text-muted-foreground">({count})</span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck, lint and tests**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all exit 0.

- [ ] **Step 4: Manual check** (`npm run dev`)

Set follow-up dates by editing applications: one yesterday, one today, plus a `to_apply` with a deadline in 3 days and a round tomorrow.
1. `/` shows Overdue (1), Due today (1), Rounds (1) and Deadlines (1).
2. Click Checked on the overdue item: it disappears and its follow-up is now today + 7 (applied) or today + 5 (in progress).
3. Click +3d on the due-today item: it disappears, and `/applications` shows follow-up = today + 3.
4. Set an item to Rejected: it disappears from every section.
5. With nothing due, the page shows "Nothing to check today".

- [ ] **Step 5: Commit**

```bash
git add src/components/today-item.tsx "src/app/(app)/page.tsx"
git commit -m "feat: add Today dashboard with quick actions"
```

---

### Task 12: Daily digest cron

**Files:**
- Create: `src/lib/mailer.ts`, `src/app/api/cron/digest/route.ts`, `vercel.json`
- Test: `src/app/api/cron/digest/route.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` (Task 7); `buildDigests`, `renderDigest` (Task 5); `istDate`.
- Produces:
  - `verifyMailer(): Promise<void>` (throws on bad Gmail credentials) and `sendMail(to: string, msg: { subject: string; text: string; html: string }): Promise<void>`.
  - `GET /api/cron/digest`: returns 401 without the secret, otherwise `{ sent: number; failed: number }`.

- [ ] **Step 1: Write the failing route test** in `src/app/api/cron/digest/route.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/api/cron/digest/route.test.ts`
Expected: FAIL, "Failed to resolve import ./route".

- [ ] **Step 3: Mailer** in `src/lib/mailer.ts`

```ts
import 'server-only';
import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

export async function verifyMailer(): Promise<void> {
  await transport.verify();
}

export async function sendMail(to: string, msg: { subject: string; text: string; html: string }): Promise<void> {
  await transport.sendMail({ from: `Job Tracker <${process.env.GMAIL_USER}>`, to, ...msg });
}
```

- [ ] **Step 4: Cron route** in `src/app/api/cron/digest/route.ts`

```ts
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
```

- [ ] **Step 5: Cron schedule** in `vercel.json`

```json
{
  "crons": [{ "path": "/api/cron/digest", "schedule": "30 2 * * *" }]
}
```

- [ ] **Step 6: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS, including the 3 route tests.

- [ ] **Step 7: Manual check against your own inbox** (`npm run dev`, with one application due today)

```bash
set -a; source .env.local; set +a
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/digest
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/digest
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cron/digest
```

Expected:
- First call: `{"sent":1,"failed":0}`, and the email arrives with a working link to the application.
- Second call: `{"sent":0,"failed":0}`.
- Third call: `401`.

To test again, clear `last_digest_on` for your row in the Supabase table editor.

- [ ] **Step 8: Commit**

```bash
git add src/lib/mailer.ts src/app/api/cron/digest vercel.json
git commit -m "feat: send daily digest email via Vercel Cron"
```

---

### Task 13: RLS verification script

**Files:**
- Create: `scripts/rls-check.mts`
- Modify: `package.json` (script `rls-check`)

**Interfaces:**
- Consumes: the schema from Task 6 and the env vars in `.env.local`. It needs Supabase's Email provider enabled (on by default) so test users can sign in with a password.

- [ ] **Step 1: Write the script** in `scripts/rls-check.mts`

```ts
// Creates two throwaway users and checks that B cannot see or change A's data. Deletes both users at the end.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const password = crypto.randomUUID();
let failures = 0;

function check(ok: boolean, message: string) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
}

async function makeUser(tag: string) {
  const email = `rls-${tag}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const a = await makeUser('a');
const b = await makeUser('b');
try {
  const { data: app, error } = await a.client
    .from('applications')
    .insert({ company: 'RLS Co', role: 'Tester', apply_method: 'email', source: 'other' })
    .select()
    .single();
  if (error) throw error;
  const { error: roundError } = await a.client.from('rounds').insert({ application_id: app.id, name: 'OA' });
  if (roundError) throw roundError;

  const apps = await b.client.from('applications').select('id').eq('id', app.id);
  check(apps.data?.length === 0, "B cannot read A's application");

  const rounds = await b.client.from('rounds').select('id').eq('application_id', app.id);
  check(rounds.data?.length === 0, "B cannot read A's rounds");

  const updated = await b.client.from('applications').update({ company: 'hacked' }).eq('id', app.id).select();
  check(updated.data?.length === 0, "B cannot update A's application");

  const sneaky = await b.client.from('rounds').insert({ application_id: app.id, name: 'sneaky' });
  check(sneaky.error !== null, "B cannot add a round to A's application");

  const profiles = await b.client.from('profiles').select('id');
  check(profiles.data?.length === 1 && profiles.data[0].id === b.id, 'B sees only their own profile');
} finally {
  await admin.auth.admin.deleteUser(a.id);
  await admin.auth.admin.deleteUser(b.id);
}
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Add the script and run it**

```bash
npm pkg set scripts.rls-check="node --env-file=.env.local scripts/rls-check.mts"
npm run rls-check
```

Expected: five `ok` lines and exit code 0. Any `FAIL` means a policy in the migration is wrong. Fix it with a new migration file; never edit the applied one.

- [ ] **Step 3: Commit**

```bash
git add scripts/rls-check.mts package.json
git commit -m "test: add two-user RLS verification script"
```

---

### Task 14: Deploy and end-to-end check

This task is outward-facing. **Ask the user before deploying.**

**Files:** none (only Vercel and Supabase settings).

- [ ] **Step 1: Production env vars (USER types the secret values)**

```
! vercel env add GMAIL_USER production
! vercel env add GMAIL_APP_PASSWORD production
! vercel env add CRON_SECRET production
```

Use the same `CRON_SECRET` as `.env.local`, or a fresh one.

- [ ] **Step 2: First deploy, to get the production URL**

```bash
vercel deploy --prod
```

Expected: a production URL such as `https://job-tracker-xxxx.vercel.app`. Note it as `$SITE`.

- [ ] **Step 3: Point the app and Supabase at that URL**

```bash
printf '%s' "$SITE" | vercel env add NEXT_PUBLIC_SITE_URL production
vercel deploy --prod
```

In Supabase → Authentication → URL Configuration, set Site URL to `$SITE` and add `$SITE/auth/callback` to Redirect URLs. Keep the localhost entry for development.

- [ ] **Step 4: Confirm the cron job is registered**

Vercel dashboard → project → Settings → Cron Jobs lists `/api/cron/digest` with schedule `30 2 * * *`. On the Hobby plan it runs some time within that hour (08:00 to 09:00 IST).

- [ ] **Step 5: End-to-end pass on production**

1. Open `$SITE` in a private window: you are redirected to `/login`.
2. Sign in with Google and land on Today.
3. Add an application with follow-up = today, and add a round for tomorrow. Both show on Today.
4. Run `curl -s -H "Authorization: Bearer <CRON_SECRET>" $SITE/api/cron/digest`: you get `{"sent":1,"failed":0}`, and the email arrives with links to `$SITE/applications/<id>`.
5. Run the same curl again: `{"sent":0,"failed":0}`.
6. Have a friend sign in. Their Today page is empty, and they cannot see your applications.

- [ ] **Step 6: Final commit, if anything changed**

```bash
git status --short
```

If anything is uncommitted (there should be nothing), commit it with a clear message. Do not push unless the user asks, and run the co-authored check from Global Constraints before any push.
