-- Buckets de stockage pour les images (logos boutique, photos produits, avatars)
insert into storage.buckets (id, name, public)
values
  ('shop-logos', 'shop-logos', true),
  ('product-images', 'product-images', true),
  ('avatars', 'avatars', true),
  ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Lecture publique (les images doivent s'afficher pour tout le monde)
create policy "Lecture publique des images"
  on storage.objects for select
  using (bucket_id in ('shop-logos','product-images','avatars','post-images'));

-- Upload : uniquement dans un dossier nommé avec son propre user id (ex: {user_id}/photo.jpg)
create policy "Upload dans son propre dossier"
  on storage.objects for insert
  with check (
    bucket_id in ('shop-logos','product-images','avatars','post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Suppression de ses propres fichiers"
  on storage.objects for delete
  using (
    bucket_id in ('shop-logos','product-images','avatars','post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
