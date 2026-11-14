create type public.posting_origin as enum ('shared');

create table public.postings (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references public.profiles (id) on delete cascade,
  origin public.posting_origin not null default 'shared',
  company text not null check (char_length(company) between 1 and 200),
  role text not null check (char_length(role) between 1 and 200),
  apply_method public.apply_method not null,
  job_url text,
  contact_email text,
  job_type public.job_type,
  location text,
  salary text,
  deadline date,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index postings_created_at_idx on public.postings (created_at desc);
create trigger postings_set_updated_at before update on public.postings
  for each row execute function public.set_updated_at();

alter table public.postings enable row level security;
-- The board is shared: every signed-in user reads every posting; only the creator changes it.
create policy "postings: read all" on public.postings for select to authenticated using (true);
create policy "postings: insert own" on public.postings for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "postings: update own" on public.postings for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "postings: delete own" on public.postings for delete to authenticated
  using (created_by = (select auth.uid()));
grant select, insert, update, delete on public.postings to authenticated;

alter table public.applications
  add column posting_id uuid references public.postings (id) on delete set null;
create index applications_posting_id_idx on public.applications (posting_id);
