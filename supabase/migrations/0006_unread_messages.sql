-- Suivi précis des messages non lus (remplace l'approximation "nombre de
-- conversations actives" par un vrai décompte de messages non lus).

create table conversation_reads (
  user_id uuid not null references profiles(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table conversation_reads enable row level security;

create policy "Chacun gère son propre suivi de lecture" on conversation_reads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Marque une conversation comme lue à l'instant présent
create or replace function mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer as $$
begin
  insert into conversation_reads (user_id, conversation_id, last_read_at)
    values (auth.uid(), p_conversation_id, now())
    on conflict (user_id, conversation_id) do update set last_read_at = now();
end; $$;

-- Nombre total de messages non lus, tous conversations confondues, pour
-- l'utilisateur courant (badge de notification précis)
create or replace function unread_messages_count()
returns integer
language sql security definer stable as $$
  select coalesce(count(*), 0)::integer
  from messages m
  join conversations c on c.id = m.conversation_id
  left join conversation_reads r on r.conversation_id = m.conversation_id and r.user_id = auth.uid()
  where (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    and m.sender_id != auth.uid()
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz);
$$;
