-- Run this once in the Supabase project's SQL editor (Database -> SQL Editor -> New query)
-- after creating the project. See README.md "Cloud backup setup" for the full walkthrough.

create table if not exists sync_docs (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection text not null,
  doc_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, doc_id)
);

alter table sync_docs enable row level security;

-- Each signed-in user can only ever see or write their own rows. This is the
-- real security boundary — the app's anon key is public by design.
create policy "Users manage their own sync docs" on sync_docs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
