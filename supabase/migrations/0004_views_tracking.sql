-- Suivi réel des vues (produits et boutiques) pour permettre de vrais
-- graphiques 7 jours et un vrai compteur de vues, sans données inventées.

create table views (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('product', 'shop')),
  target_id uuid not null,
  viewer_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_views_target on views (target_type, target_id);
create index idx_views_created_at on views (created_at);

alter table views enable row level security;

-- Tout le monde peut enregistrer une vue (y compris visiteurs anonymes non
-- connectés, viewer_id sera alors null) — c'est une simple télémétrie
-- publique, pas une donnée sensible.
create policy "Enregistrement public d'une vue" on views for insert with check (true);

-- Seuls les propriétaires (via leurs boutiques/produits) et les admins
-- peuvent lire le détail des vues, pour ne pas exposer le trafic d'un
-- concurrent.
create policy "Lecture des vues par le propriétaire ou un admin" on views for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
    or (target_type = 'shop' and exists (select 1 from shops s where s.id = target_id and s.owner_id = auth.uid()))
    or (target_type = 'product' and exists (
      select 1 from products pr join shops s on s.id = pr.shop_id
      where pr.id = target_id and s.owner_id = auth.uid()
    ))
  );

-- Fonction pratique : enregistrer une vue en une seule requête depuis le client
create or replace function record_view(p_target_type text, p_target_id uuid)
returns void
language plpgsql security definer as $$
begin
  insert into views (target_type, target_id, viewer_id) values (p_target_type, p_target_id, auth.uid());
end; $$;
