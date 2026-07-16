-- Met à jour automatiquement le compteur votes_count d'une suggestion
create or replace function bump_suggestion_votes()
returns trigger
language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update suggestions set votes_count = votes_count + 1 where id = new.suggestion_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update suggestions set votes_count = votes_count - 1 where id = old.suggestion_id;
    return old;
  end if;
  return null;
end; $$;

create trigger on_suggestion_vote_insert
  after insert on suggestion_votes
  for each row execute function bump_suggestion_votes();

create trigger on_suggestion_vote_delete
  after delete on suggestion_votes
  for each row execute function bump_suggestion_votes();
