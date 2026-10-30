-- Run once in Supabase SQL Editor. The frontend only uses the publishable key.
create table if not exists public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint save_owner_matches check (save->>'id' = user_id::text)
);
alter table public.player_progress enable row level security;
revoke all on public.player_progress from anon;
grant select, insert, update on public.player_progress to authenticated;
drop policy if exists "read own progress" on public.player_progress;
create policy "read own progress" on public.player_progress for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "insert own progress" on public.player_progress;
create policy "insert own progress" on public.player_progress for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "update own progress" on public.player_progress;
create policy "update own progress" on public.player_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Revision comparison prevents two devices from silently overwriting each other.
create or replace function public.save_player_progress(p_save jsonb, p_expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = public as $$
declare next_revision bigint;
begin
  if auth.uid() is null or p_save->>'id' is distinct from auth.uid()::text then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_expected_revision = 0 then
    insert into public.player_progress(user_id, save, revision)
    values(auth.uid(), p_save, 1)
    on conflict(user_id) do nothing
    returning revision into next_revision;
  else
    update public.player_progress
    set save = p_save, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = p_expected_revision
    returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'SAVE_CONFLICT'; end if;
  return next_revision;
end; $$;
revoke all on function public.save_player_progress(jsonb, bigint) from public, anon;
grant execute on function public.save_player_progress(jsonb, bigint) to authenticated;
