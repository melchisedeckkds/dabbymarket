-- DabbyMarket — Module Admin : modération étendue
-- Blocage de boutique, suppression de publication/article/compte,
-- ajustement manuel de Pépites, file de signalements.

-- =========================================================
-- COLONNES DE MODÉRATION
-- =========================================================
alter table shops add column if not exists is_blocked boolean not null default false;
alter table shops add column if not exists blocked_reason text;

alter table profiles add column if not exists is_blocked boolean not null default false;

-- Une boutique bloquée reste visible à son propriétaire et à l'admin,
-- mais disparaît du marché et des recherches publiques.
drop policy if exists "Boutiques visibles par tous" on shops;
create policy "Boutiques visibles (sauf bloquées pour le public)" on shops for select
  using (
    not is_blocked
    or owner_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- =========================================================
-- SIGNALEMENTS (file de modération pour l'admin)
-- =========================================================
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('shop','product','post','user')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table reports enable row level security;
create policy "Admin et auteur lisent les signalements" on reports for select
  using (auth.uid() = reporter_id or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "Un utilisateur signale" on reports for insert with check (auth.uid() = reporter_id);

create index if not exists reports_status_idx on reports (status);
create index if not exists shops_is_blocked_idx on shops (is_blocked);

-- =========================================================
-- GARDE-FOU COMMUN : réservé aux admins
-- =========================================================
create or replace function admin_check()
returns void language plpgsql as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
end; $$;

-- =========================================================
-- FONCTIONS ADMIN (SECURITY DEFINER — contournent la RLS)
-- =========================================================

-- Bloquer / débloquer une boutique
create or replace function admin_set_shop_blocked(p_shop_id uuid, p_blocked boolean, p_reason text default null)
returns void language plpgsql security definer as $$
begin
  perform admin_check();
  update shops set is_blocked = p_blocked, blocked_reason = case when p_blocked then p_reason else null end
    where id = p_shop_id;
end; $$;

-- Certifier / décertifier une boutique (badge "vérifié")
create or replace function admin_set_shop_verified(p_shop_id uuid, p_verified boolean)
returns void language plpgsql security definer as $$
begin
  perform admin_check();
  update shops set verified = p_verified where id = p_shop_id;
end; $$;

-- Supprimer une publication simple
create or replace function admin_delete_post(p_post_id uuid)
returns void language plpgsql security definer as $$
begin
  perform admin_check();
  delete from posts where id = p_post_id;
end; $$;

-- Supprimer un article (produit)
create or replace function admin_delete_product(p_product_id uuid)
returns void language plpgsql security definer as $$
begin
  perform admin_check();
  delete from products where id = p_product_id;
end; $$;

-- Suspendre / réactiver un compte (accès bloqué sans supprimer les données)
create or replace function admin_suspend_account(p_user_id uuid, p_suspended boolean)
returns void language plpgsql security definer as $$
begin
  perform admin_check();
  update profiles set is_blocked = p_suspended where id = p_user_id;
end; $$;

-- Supprimer définitivement un compte (cascade : boutiques, produits, posts, avis...)
create or replace function admin_delete_account(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  perform admin_check();
  if exists (select 1 from profiles where id = p_user_id and is_admin) then
    raise exception 'Impossible de supprimer un compte administrateur';
  end if;
  delete from auth.users where id = p_user_id;
end; $$;

-- Créditer / débiter manuellement des Pépites (geste commercial, correction litige...)
create or replace function admin_adjust_pepites(p_user_id uuid, p_amount integer, p_note text default null)
returns void language plpgsql security definer as $$
begin
  perform admin_check();
  if p_amount = 0 then raise exception 'Montant invalide'; end if;
  update profiles set pepites_balance = greatest(0, pepites_balance + p_amount) where id = p_user_id;
  insert into pepites_transactions (user_id, type, amount, status, admin_note, confirmed_by, confirmed_at)
    values (p_user_id, case when p_amount > 0 then 'admin_grant' else 'admin_adjustment' end, p_amount, 'confirmed', p_note, auth.uid(), now());
end; $$;

-- Résoudre un signalement (le classer, sans forcément supprimer le contenu visé)
create or replace function admin_resolve_report(p_report_id uuid, p_status text)
returns void language plpgsql security definer as $$
begin
  perform admin_check();
  if p_status not in ('resolved','dismissed') then raise exception 'Statut invalide'; end if;
  update reports set status = p_status, resolved_by = auth.uid(), resolved_at = now() where id = p_report_id;
end; $$;
