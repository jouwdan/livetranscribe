-- Enable realtime for transcriptions table
alter publication supabase_realtime add table transcriptions;

-- Ensure RLS is enabled but allows reads for all viewers
alter table transcriptions enable row level security;

-- Allow all users to read transcriptions
drop policy if exists "Allow public read access to transcriptions" on transcriptions;
create policy "Allow public read access to transcriptions"
  on transcriptions for select
  using (true);

-- Allow authenticated users to insert transcriptions (for broadcasters)
drop policy if exists "Allow authenticated insert to transcriptions" on transcriptions;
create policy "Allow authenticated insert to transcriptions"
  on transcriptions for insert
  with check (true);
