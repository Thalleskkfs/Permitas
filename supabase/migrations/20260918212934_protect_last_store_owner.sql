-- Hardening: invariante "toda loja mantém pelo menos um owner".
--
-- Bloqueia, no banco, remover ou rebaixar/mover o último owner de uma loja. Vale para
-- qualquer ator (authenticated, service_role, cascades a partir de auth.users), pois é
-- um trigger e não uma policy. Excluir a própria loja continua permitido: o cascade
-- remove os membros depois que a loja já não existe.
--
-- O trigger é AFTER (e não BEFORE) de propósito: um BEFORE ROW não enxerga as alterações
-- feitas pelas linhas anteriores do mesmo comando, então um único DELETE/UPDATE em lote
-- removeria todos os owners. Depois do comando, o estado final já é visível.
--
-- SECURITY DEFINER é necessário: depois de apagar a própria linha, o usuário deixa de
-- ser membro e a RLS esconderia a loja e os demais owners dele, fazendo a checagem
-- concluir errado. A função é de trigger (sem argumentos, não chamável diretamente),
-- vive em schema não exposto pela API e usa search_path vazio.

create function private.protect_last_store_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.stores s where s.id = old.store_id) then
    return null;
  end if;

  -- Serializa mudanças de owners da mesma loja: duas transações concorrentes não podem
  -- remover, cada uma, "o outro" owner. A segunda espera a primeira confirmar e então
  -- reavalia com o estado já confirmado (READ COMMITTED, padrão do Supabase).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.store_id::text, 0));

  if not exists (
    select 1
    from public.store_members m
    where m.store_id = old.store_id
      and m.role = 'owner'
  ) then
    raise exception 'A loja deve manter pelo menos um owner.'
      using errcode = 'restrict_violation',
            hint = 'Promova outro membro a owner antes de remover ou rebaixar este.';
  end if;

  return null;
end;
$$;

revoke all on function private.protect_last_store_owner() from public;

create trigger store_members_protect_last_owner_on_delete
  after delete on public.store_members
  for each row
  when (old.role = 'owner')
  execute function private.protect_last_store_owner();

create trigger store_members_protect_last_owner_on_update
  after update of role, store_id on public.store_members
  for each row
  when (
    old.role = 'owner'
    and (new.role is distinct from old.role or new.store_id is distinct from old.store_id)
  )
  execute function private.protect_last_store_owner();
