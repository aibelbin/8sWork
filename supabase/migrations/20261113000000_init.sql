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
