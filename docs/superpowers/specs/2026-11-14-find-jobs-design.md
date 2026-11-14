# Find Jobs: Iteration 2 Design

Date: 2026-11-14
Builds on: `2026-11-13-job-tracker-design.md`

## Goal

Let users put job postings on a shared board, the **Find jobs** tab, so friends can find jobs and start tracking them in one click. This is a job board inside a tracker, not a social feature: no profiles, comments, likes or names.

A later iteration fills the same board from free job APIs. This design keeps that in mind but doesn't build it.

## Decisions

- Every signed-in user can see every posting.
- Postings are anonymous. Who added one is stored, so they can edit or remove it, but it is never shown.
- The sharer's status, rounds, resume version and notes are never copied into a posting.
- A posting can come from the application form (a "Share this job" checkbox) or from a "Share a job" form on the board that doesn't touch the user's tracker.

## Data model

### New table `postings`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `created_by` | uuid | `default auth.uid()`, references `profiles.id` `on delete cascade`; null for API postings later |
| `origin` | enum `posting_origin` | `shared` (only value for now; `api` is added with the API iteration) |
| `company` | text | required, 1–200 chars |
| `role` | text | required, 1–200 chars |
| `apply_method` | enum `apply_method` | required |
| `job_url` | text | optional, valid URL |
| `contact_email` | text | optional, valid email |
| `job_type` | enum `job_type` | optional |
| `location` | text | optional |
| `salary` | text | optional ("CTC / package" in the UI) |
| `deadline` | date | optional |
| `details` | text | optional; how to apply, eligibility, etc. Shown to everyone. |
| `created_at`, `updated_at` | timestamptz | `set_updated_at` trigger as on `applications` |

RLS:
- select: `to authenticated using (true)`.
- insert: `with check (created_by = (select auth.uid()))`.
- update: `using` and `with check` `created_by = (select auth.uid())`.
- delete: `using (created_by = (select auth.uid()))`.

Grants: `select, insert, update, delete` to `authenticated`. Index on `created_at desc`.

### Change to `applications`

- Add `posting_id uuid references postings(id) on delete set null`. Index it.
- It means one of two things, and the code tells them apart by `postings.created_by`:
  - **I shared this application:** the posting was created from this application and `created_by` is me.
  - **I'm tracking someone's posting:** `created_by` is someone else.

## Shared mapping (pure functions, `src/lib/postings.ts`)

- `postingFromApplication(app)` → posting fields: company, role, apply_method, job_url, contact_email, job_type, location, salary, deadline. `details` is left empty, since application notes are private.
- `applicationFromPosting(posting, today)` → new-application fields: the same fields, plus `status = 'to_apply'`, `source = 'friend'`, `source_detail = 'Find jobs'`, `notes = posting.details`, `posting_id = posting.id`, and `follow_up_on` from `suggestFollowUp(…, 'created', today)`, which gives deadline − 1 day or null.

## Application form: "Share this job" checkbox

- Shown on the new and edit forms, below the main fields. Label: "Share this job on Find jobs (anonymous)".
- Not shown when the application tracks someone else's posting. It shows "From Find jobs" instead.
- On edit, it is pre-ticked when the application has its own posting.
- On save, in `createApplication` / `updateApplication` after the application row is written:
  - **Ticked, no posting:** insert `postingFromApplication(app)` and set `applications.posting_id`.
  - **Ticked, own posting:** update the posting with `postingFromApplication(app)`. `details` is left untouched.
  - **Unticked, own posting:** delete the posting. `on delete set null` clears `posting_id` on every application that pointed to it, so friends tracking it keep their copies.
- If the posting write fails, the application save still stands. The user sees a toast: "Saved, but sharing failed".
- Deleting an application that owns a posting also deletes the posting.

## Find jobs tab

- New nav link **Find jobs** → `/jobs`, between Applications and Settings.
- **`/jobs`**:
  - Lists postings newest first, hiding those with `deadline < today` (IST).
  - Search by company or role (in JS, as on `/applications`) and filter by job type.
  - Each posting is a card with company, role, CTC, location, job type, deadline, how to apply (the job link as a button, or the contact email), and details.
  - Actions:
    - **Track this**: a server action inserts `applicationFromPosting(posting, today)` and redirects to the new application's page. It is not shown on postings you added.
    - **Tracking**: replaces Track this when one of your applications has `posting_id` = this posting. Links to that application.
    - **Remove**: only on postings you added. Asks for confirmation, then deletes.
  - Empty state: "No jobs shared yet." plus a Share a job button.
  - A **Share a job** button in the header links to `/jobs/new`.
- **`/jobs/new`**:
  - The same `AutoFill` box (text / screenshot / link), then the fields company, role, how to apply, job link, contact email, job type, location, CTC, deadline and details.
  - On submit it inserts a posting and redirects to `/jobs`. Nothing is added to the user's applications.
  - Validated by `postingSchema` in `src/lib/schemas.ts`, which reuses the field rules from `applicationSchema`.
- Postings are not editable from the board in this iteration. Shares made with the checkbox stay in sync through the application form. Share-only postings can be removed and re-shared.

## Error handling

- Every write goes through a server action with zod validation and returns `FormState`, matching the existing forms.
- Track this on a posting that was removed in the meantime shows a toast, "That job was removed", and refreshes the list.
- RLS keeps the rules safe even if the UI is bypassed: nobody can edit or delete another user's posting.

## Testing

- Unit (Vitest):
  - `postingFromApplication` never copies status, rounds, resume, notes or source.
  - `applicationFromPosting` sets `to_apply`, source `friend`, notes from details, and follow-up as deadline − 1 or null.
  - `postingSchema` accepts a valid posting and rejects a missing company or role and a bad URL or email.
- RLS check script: user B can read A's posting but cannot update or delete it; B can insert their own; an insert with someone else's `created_by` fails.
- Manual on the deployed site:
  1. Share an application with the checkbox and see it on Find jobs.
  2. As a second user, click Track this, check the new application, and see "Tracking".
  3. As the first user, untick the checkbox and confirm the posting is gone while the second user's application stays.

## Later: job APIs (not in this iteration)

- Add `api` to `posting_origin`, plus nullable `external_source` and `external_id` columns with a unique index on the pair, so the same job is never inserted twice.
- A daily Vercel Cron job fetches from free job APIs with the service-role key and upserts postings with `created_by = null`.
- Find jobs needs no changes. A filter by origin can come later if the board gets noisy.
