-- À exécuter une fois dans Supabase > SQL Editor
create table if not exists docs (
  path text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table docs enable row level security;
create policy "acces appli" on docs for all using (true) with check (true);
alter publication supabase_realtime add table docs;
