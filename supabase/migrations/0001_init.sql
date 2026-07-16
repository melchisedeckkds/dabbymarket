-- DabbyMarket — schéma initial Supabase
-- Toutes les tables utilisent Row Level Security (RLS) : chaque utilisateur
-- ne peut lire/écrire que ce qui est autorisé par les politiques ci-dessous.

create extension if not exists "pgcrypto";

-- =========================================================
-- PROFILS (1 profil = 1 compte réel, lié à auth.users)
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  name text not null,
  avatar_url text,
  pepites_balance integer not null default 500,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Les profils publics sont lisibles par tous"
  on profiles for select using (true);

create policy "Un utilisateur modifie seulement son propre profil"
  on profiles for update using (auth.uid() = id);

-- Le solde de Pépites ne doit JAMAIS être modifiable directement par le client.
-- On bloque la colonne pepites_balance en update direct via une règle applicative :
-- seules les fonctions RPC ci-dessous (SECURITY DEFINER) peuvent la modifier.
revoke update (pepites_balance) on profiles from authenticated;

-- =========================================================
-- BOUTIQUES
-- =========================================================
create table shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  logo_url text,
  lat double precision,
  lng double precision,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table shops enable row level security;
create policy "Boutiques visibles par tous" on shops for select using (true);
create policy "Le propriétaire gère sa boutique" on shops for insert with check (auth.uid() = owner_id);
create policy "Le propriétaire modifie sa boutique" on shops for update using (auth.uid() = owner_id);
create policy "Le propriétaire supprime sa boutique" on shops for delete using (auth.uid() = owner_id);

-- =========================================================
-- PRODUITS
-- =========================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  description text,
  price_xaf integer not null,
  category text not null,
  condition text not null check (condition in ('Neuf','Occasion')),
  images text[] not null default '{}',
  boosted_until timestamptz,
  created_at timestamptz not null default now()
);

alter table products enable row level security;
create policy "Produits visibles par tous" on products for select using (true);
create policy "Le propriétaire de la boutique publie" on products for insert
  with check (exists (select 1 from shops where shops.id = shop_id and shops.owner_id = auth.uid()));
create policy "Le propriétaire de la boutique modifie" on products for update
  using (exists (select 1 from shops where shops.id = shop_id and shops.owner_id = auth.uid()));
create policy "Le propriétaire de la boutique supprime" on products for delete
  using (exists (select 1 from shops where shops.id = shop_id and shops.owner_id = auth.uid()));

-- =========================================================
-- POSTS (publications non liées à un produit)
-- =========================================================
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table posts enable row level security;
create policy "Posts visibles par tous" on posts for select using (true);
create policy "L'auteur publie" on posts for insert with check (auth.uid() = author_id);
create policy "L'auteur supprime" on posts for delete using (auth.uid() = author_id);

-- =========================================================
-- COUPS DE CŒUR (likes) — sur produit ou post
-- =========================================================
create table likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id),
  unique (user_id, post_id),
  check (num_nonnulls(product_id, post_id) = 1)
);

alter table likes enable row level security;
create policy "Coups de cœur visibles par tous" on likes for select using (true);
create policy "Un utilisateur like en son nom" on likes for insert with check (auth.uid() = user_id);
create policy "Un utilisateur retire son coup de cœur" on likes for delete using (auth.uid() = user_id);

-- =========================================================
-- COMMENTAIRES — sur produit ou post
-- =========================================================
create table comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(product_id, post_id) = 1)
);

alter table comments enable row level security;
create policy "Commentaires visibles par tous" on comments for select using (true);
create policy "Un utilisateur commente en son nom" on comments for insert with check (auth.uid() = user_id);
create policy "Un utilisateur supprime son commentaire" on comments for delete using (auth.uid() = user_id);

-- =========================================================
-- PANIER D'ENVIE (favoris)
-- =========================================================
create table wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table wishlist enable row level security;
create policy "Chacun voit son panier d'envie" on wishlist for select using (auth.uid() = user_id);
create policy "Ajouter à son panier d'envie" on wishlist for insert with check (auth.uid() = user_id);
create policy "Retirer de son panier d'envie" on wishlist for delete using (auth.uid() = user_id);

-- =========================================================
-- CLIENTS FIDÈLES (suivre une boutique)
-- =========================================================
create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, shop_id)
);

alter table follows enable row level security;
create policy "Follows visibles par tous" on follows for select using (true);
create policy "Suivre une boutique" on follows for insert with check (auth.uid() = follower_id);
create policy "Ne plus suivre" on follows for delete using (auth.uid() = follower_id);

-- =========================================================
-- MESSAGERIE
-- =========================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid references shops(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  order_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (buyer_id, seller_id, product_id)
);

alter table conversations enable row level security;
create policy "Participants voient leur conversation" on conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "L'acheteur démarre la conversation" on conversations for insert
  with check (auth.uid() = buyer_id);
create policy "Un participant confirme la réception" on conversations for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  text text,
  shared_lat double precision,
  shared_lng double precision,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;
create policy "Participants lisent les messages" on messages for select
  using (exists (select 1 from conversations c where c.id = conversation_id
    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
create policy "Participants envoient des messages" on messages for insert
  with check (auth.uid() = sender_id and exists (select 1 from conversations c where c.id = conversation_id
    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));

-- =========================================================
-- AVIS (déverrouillés seulement après confirmation de réception)
-- =========================================================
create table reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (conversation_id)
);

alter table reviews enable row level security;
create policy "Avis visibles par tous" on reviews for select using (true);
create policy "Avis seulement après réception confirmée" on reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and c.buyer_id = auth.uid()
        and c.order_confirmed = true
    )
  );

-- =========================================================
-- PÉPITES — grand livre des transactions (jamais modifiable par le client)
-- =========================================================
create table pepites_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('recharge','publish','boost_product','boost_shop','admin_grant','admin_adjustment')),
  amount integer not null, -- positif = crédit, négatif = débit
  method text, -- 'OrangeMoney' | 'MTNMoMo' | 'card' | null pour les dépenses internes
  reference_code text, -- code de transaction saisi par l'utilisateur
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  admin_note text,
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table pepites_transactions enable row level security;
create policy "Un utilisateur voit ses propres transactions" on pepites_transactions for select
  using (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "Un utilisateur crée une demande de recharge" on pepites_transactions for insert
  with check (auth.uid() = user_id and type = 'recharge' and status = 'pending');

-- =========================================================
-- SUGGESTIONS
-- =========================================================
create table suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('idee','bug','amelioration')),
  text text not null,
  votes_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table suggestions enable row level security;
create policy "Suggestions visibles par tous" on suggestions for select using (true);
create policy "Un utilisateur propose" on suggestions for insert with check (auth.uid() = user_id);

create table suggestion_votes (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  unique (suggestion_id, user_id)
);

alter table suggestion_votes enable row level security;
create policy "Votes visibles par tous" on suggestion_votes for select using (true);
create policy "Un utilisateur vote une fois" on suggestion_votes for insert with check (auth.uid() = user_id);

-- =========================================================
-- FONCTIONS RPC — seules portes d'entrée pour toucher aux Pépites
-- (SECURITY DEFINER : s'exécutent avec les droits du propriétaire de la
-- fonction, pas ceux du client, donc le solde ne peut pas être trafiqué)
-- =========================================================

-- Dépenser des Pépites (publication, boost...) — échoue si solde insuffisant
create or replace function spend_pepites(p_amount integer, p_type text)
returns integer
language plpgsql security definer as $$
declare v_balance integer;
begin
  if p_amount <= 0 then raise exception 'Montant invalide'; end if;
  select pepites_balance into v_balance from profiles where id = auth.uid() for update;
  if v_balance < p_amount then
    raise exception 'Solde de Pépites insuffisant';
  end if;
  update profiles set pepites_balance = pepites_balance - p_amount where id = auth.uid();
  insert into pepites_transactions (user_id, type, amount, status, confirmed_at, confirmed_by)
    values (auth.uid(), p_type, -p_amount, 'confirmed', now(), auth.uid());
  return v_balance - p_amount;
end; $$;

-- Demander une recharge (crée une transaction "pending" — ne crédite rien encore)
create or replace function request_recharge(p_amount integer, p_method text, p_reference text)
returns uuid
language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into pepites_transactions (user_id, type, amount, method, reference_code, status)
    values (auth.uid(), 'recharge', p_amount, p_method, p_reference, 'pending')
    returning id into v_id;
  return v_id;
end; $$;

-- Validation ADMIN d'une recharge (Option A : vérification manuelle du vrai paiement reçu)
create or replace function confirm_recharge(p_transaction_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer as $$
declare v_tx pepites_transactions%rowtype;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  select * into v_tx from pepites_transactions where id = p_transaction_id and status = 'pending' for update;
  if not found then raise exception 'Transaction introuvable ou déjà traitée'; end if;

  if p_approve then
    update profiles set pepites_balance = pepites_balance + v_tx.amount where id = v_tx.user_id;
    update pepites_transactions set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now(), admin_note = p_note
      where id = p_transaction_id;
  else
    update pepites_transactions set status = 'rejected', confirmed_by = auth.uid(), confirmed_at = now(), admin_note = p_note
      where id = p_transaction_id;
  end if;
end; $$;

-- Confirmer la réception d'un article (débloque le droit de laisser un avis)
create or replace function confirm_order_received(p_conversation_id uuid)
returns void
language plpgsql security definer as $$
begin
  update conversations set order_confirmed = true
    where id = p_conversation_id and buyer_id = auth.uid();
end; $$;

-- Nouveau profil créé automatiquement à l'inscription (500 Pépites offertes)
create or replace function handle_new_user()
returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, phone, name, pepites_balance)
    values (new.id, coalesce(new.phone, new.email), coalesce(new.raw_user_meta_data->>'name', 'Nouvel utilisateur'), 500);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
