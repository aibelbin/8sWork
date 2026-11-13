# Job Application Tracker: Iteration 1 Design

Date: 2026-11-13

## Goal

A website where I (and friends from college) track every job application in one place: how we applied, where we found it, what rounds followed, and when to check on it next. The app reminds each user daily about follow-ups that are due.

Out of scope for iteration 1: finding or importing jobs, sharing applications between users, analytics/charts, per-user timezones, push notifications.

## Stack

- **Next.js (App Router)** on **Vercel**, with Tailwind and shadcn/ui.
- **Supabase** (via Vercel Marketplace): Postgres database and Google sign-in (Supabase Auth, `@supabase/ssr` cookies).
- **Vercel Cron**: one daily job for the digest.
- **Gmail SMTP** through `nodemailer` with an app password for the digest email. No domain needed; can switch to Resend later if a domain is bought.

## Users and access

- Sign-in is Google only. A `profiles` row is created on first sign-in.
- Each user's data is private. Row-level security (RLS) is enabled on every table with the policy `user_id = auth.uid()` for select, insert, update and delete.
- The browser only ever holds the Supabase anon key.

## Data model

### `profiles`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key, equals `auth.users.id` |
| `email` | text | from Google |
| `name` | text | from Google |
| `digest_enabled` | boolean | default `true` |
| `last_digest_on` | date | nullable; IST date of last successful digest |

### `applications`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `user_id` | uuid | owner, references `profiles.id` |
| `company` | text | required |
| `role` | text | required |
| `status` | enum | `to_apply`, `applied`, `in_progress`, `offer`, `rejected`, `ghosted`, `withdrawn` |
| `apply_method` | enum | `email`, `form`, `portal`, `referral`, `other` |
| `source` | enum | `college_group`, `linkedin`, `company_site`, `job_board`, `friend`, `other` |
| `source_detail` | text | optional, e.g. "CSE 2026 WhatsApp group" |
| `job_url` | text | optional, valid URL |
| `contact_email` | text | optional, valid email |
| `resume_version` | text | optional free label |
| `job_type` | enum | `internship`, `full_time`, `contract`; optional |
| `location` | text | optional free text |
| `salary` | text | optional free text ("12 LPA", "30k stipend") |
| `deadline` | date | optional |
| `applied_on` | date | set when status first leaves `to_apply` (defaults to today, editable) |
| `follow_up_on` | date | nullable; drives reminders |
| `notes` | text | optional |
| `created_at`, `updated_at` | timestamptz | |

### `rounds`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `application_id` | uuid | references `applications.id`, `on delete cascade` |
| `user_id` | uuid | duplicated owner so RLS is a single-column check |
| `name` | text | required, free text ("OA", "Tech 1", "HR") |
| `scheduled_at` | timestamptz | optional |
| `result` | enum | `upcoming`, `passed`, `failed`, `awaiting` |
| `notes` | text | optional |
| `created_at` | timestamptz | |

## Pages

All pages are mobile-friendly. Every page except `/login` redirects signed-out users to `/login`.

- **`/login`**: one "Continue with Google" button.
- **`/` (Today)**: four lists:
  - Overdue: `follow_up_on < today`.
  - Due today: `follow_up_on = today`.
  - Rounds in the next 7 days: `result = upcoming` with `scheduled_at` within 7 days.
  - Deadlines in the next 7 days: `status = to_apply` with `deadline` within 7 days.

  Excluded: applications with status `rejected`, `ghosted` or `withdrawn`.

  Each item has these quick actions:
  - **Checked**: sets the next follow-up by the rules below.
  - **Snooze** +1 / +3 / +7 days.
  - **Change status**.
- **`/applications`**: every application as a table on desktop and cards on mobile. Search by company or role, filter by status and source, and sort by applied date or follow-up date. Status can be changed inline.
- **`/applications/new`**: quick-add form.
  - Shows company, role, method, source, status (default `applied`), applied-on date (default today; replaced by the deadline field when status is `to_apply`) and follow-up date.
  - "More details" expands to the remaining fields.
  - The suggested `follow_up_on` is pre-filled and editable.
- **`/applications/[id]`**: edit any field, rounds as a timeline with inline add/edit, delete with confirmation.
- **`/settings`**: digest on/off toggle and sign-out.

## Follow-up rules

One pure function, `suggestFollowUp(application, event, today)`. It runs only on these events: creating an application, changing its status, adding or updating a round, or clicking **Checked**. When none of these happen, `follow_up_on` is left alone, so a date set by hand stays. In forms, the suggestion pre-fills the field and the user can change it before saving. Quick actions on the Today page save the suggestion directly.

The suggestion depends on the application's current state. The event only picks the base date for `applied`. **Checked** uses the same rules.

| Situation (checked top to bottom) | Suggested `follow_up_on` |
|---|---|
| status `rejected`, `ghosted` or `withdrawn` | null |
| `to_apply` with deadline | deadline − 1 day |
| `to_apply` without deadline | null |
| `offer` | today + 3 days |
| has an `upcoming` round with `scheduled_at` | earliest such round's date (IST) + 1 day |
| `in_progress` | today + 5 days |
| `applied`, on create or status change | `applied_on` (or today) + 7 days |
| `applied`, on **Checked** or round saved | today + 7 days |

Rounds that are `passed`, `failed`, `awaiting` or unscheduled never set the date.

"Today" is always the current date in `Asia/Kolkata`.

## Daily digest

- A Vercel Cron job calls `GET /api/cron/digest` daily at `30 2 * * *` (02:30 UTC = 08:00 IST).
- The route returns 401 unless the request carries `Authorization: Bearer ${CRON_SECRET}`.
- It uses the Supabase service-role key (server-only) and fetches everything in bulk queries, with no per-user query loop:
  - every profile with `digest_enabled = true` and `last_digest_on` null or before today;
  - those users' open applications (status not rejected, ghosted or withdrawn) with `follow_up_on <= today`;
  - their rounds with `result = upcoming` and `scheduled_at` on today or tomorrow;
  - their `to_apply` applications with `deadline` within the next 2 days.
- Items are grouped per user by a pure function, `buildDigests(profiles, applications, rounds, today)`. Users with no items get no email.
- Each user gets one email listing overdue, due-today, upcoming-round and deadline items, with a link to the Today page.
- After a successful send, the route sets that user's `last_digest_on = today`. This makes repeated runs on the same day safe.
- shortcut: one timezone (IST) for all users; add a `profiles.timezone` column and hourly cron if friends outside India join.

## Error handling

- **Validation:** each form has one zod schema, used in both the browser and the server action. Errors show next to the field. Company, role and round name are required. URL and email must be well-formed, and any dates entered must be valid.
- **Failed writes:** the server action returns the error, the UI shows a toast, and the form keeps what the user typed.
- **Digest sends:** each user's email is sent and logged separately. If one send fails, it is logged, that user's `last_digest_on` is not updated (they are retried on the next run), and the job continues. A Gmail auth failure ends the run with a clear error in the Vercel logs.
- **Delete:** deleting an application asks for confirmation, and its rounds are removed by cascade.

## Configuration

Server-only environment variables, managed with `vercel env`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `CRON_SECRET`

Public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`, used for links in emails

Google OAuth client is configured in Google Cloud Console and entered in Supabase Auth settings.

## Testing

- **Unit (Vitest):**
  - `suggestFollowUp`: one test per row of the rules table.
  - `buildDigests`: boundaries for overdue, today and the 2-day deadline window in IST; users with no items get nothing; closed applications are excluded.
- **RLS check:** a script signs in as two test users and confirms user B cannot select or update user A's application or rounds.
- **Manual end-to-end on a Vercel preview:**
  1. Sign in with Google.
  2. Add an application and a round, and confirm they show on the Today page.
  3. Call the cron route with the secret and confirm the email arrives.
  4. Call it again and confirm no second email.

## Later iterations (not in this spec)

- Finding jobs and adding them from within the app.
- Sharing postings with friends (e.g. from a college group).
- Stats and charts.
- Per-user timezones.
- Resend with a custom domain.
