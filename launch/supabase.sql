-- Storage for ranranli.net/launch (run once in the Supabase SQL editor).
--
-- The whole launch pad (tasks, settings) is one encrypted blob. The browser derives two
-- values from the password: an AES key that never leaves the browser, and an access token.
-- Only a hash of the token is stored here. Nobody can read the table directly; the two
-- functions below hand out / accept the blob only with the right token.

create table if not exists public.launch_vault (
  id          text primary key,
  token_hash  text not null,
  blob        text not null,
  rev         bigint not null default 1,
  updated_at  timestamptz not null default now()
);

alter table public.launch_vault enable row level security;
revoke all on public.launch_vault from anon, authenticated;

create or replace function public.launch_get(p_id text, p_token text)
returns table (blob text, rev bigint, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select v.blob, v.rev, v.updated_at
  from public.launch_vault v
  where v.id = p_id
    and v.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Saves a new blob if p_rev is still the current revision and returns the new revision.
-- If someone saved in between (another device), it returns minus the current revision,
-- so the browser can merge and try again. A wrong token raises an error.
create or replace function public.launch_put(p_id text, p_token text, p_blob text, p_rev bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  v_rev  bigint;
begin
  if length(p_blob) > 3000000 then
    raise exception 'launch pad data too large';
  end if;

  update public.launch_vault
     set blob = p_blob, rev = rev + 1, updated_at = now()
   where id = p_id and token_hash = v_hash and rev = p_rev
  returning rev into v_rev;

  if v_rev is not null then
    return v_rev;
  end if;

  select rev into v_rev from public.launch_vault where id = p_id and token_hash = v_hash;
  if v_rev is null then
    raise exception 'not allowed' using errcode = '28000';
  end if;
  return -v_rev;
end;
$$;

revoke all on function public.launch_get(text, text) from public;
revoke all on function public.launch_put(text, text, text, bigint) from public;
grant execute on function public.launch_get(text, text) to anon, authenticated;
grant execute on function public.launch_put(text, text, text, bigint) to anon, authenticated;

-- The vault row itself (with the encrypted starting board) is inserted once, separately.
-- There is deliberately no function that creates rows.
