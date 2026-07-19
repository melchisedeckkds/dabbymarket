-- Quota quotidien réel pour l'IA (La Guérite), appliqué côté serveur pour
-- protéger le quota gratuit partagé de l'API Gemini contre les abus.

create table ai_usage (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table ai_usage enable row level security;

-- Personne ne lit/écrit directement cette table depuis le client — tout
-- passe par la fonction RPC ci-dessous, appelée uniquement par la fonction
-- Edge avec la clé de service.
create policy "Aucun accès direct côté client" on ai_usage for all using (false);

-- Vérifie et incrémente l'usage du jour ; renvoie false si la limite est atteinte.
create or replace function check_and_increment_ai_usage(p_user_id uuid, p_daily_limit integer default 40)
returns boolean
language plpgsql security definer as $$
declare v_count integer;
begin
  insert into ai_usage (user_id, day, count)
    values (p_user_id, current_date, 1)
    on conflict (user_id, day) do update set count = ai_usage.count + 1
    returning count into v_count;
  return v_count <= p_daily_limit;
end; $$;
