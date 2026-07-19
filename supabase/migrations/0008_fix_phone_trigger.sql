-- Corrige un vrai bug trouvé dans handle_new_user() : comme l'inscription
-- utilise un compte email/mot de passe (astuce pour éviter les SMS payants,
-- voir src/lib/auth.tsx), la colonne native "phone" de auth.users reste
-- vide — le vrai numéro de téléphone est transmis séparément dans
-- raw_user_meta_data. L'ancienne version de cette fonction utilisait new.phone
-- en premier, qui est toujours NULL ici, et retombait donc sur new.email
-- (l'adresse interne factice du type "237696430723@dabbymarket.app") au lieu
-- du vrai numéro — le profil affichait alors ce faux email à la place du
-- numéro de téléphone.

create or replace function handle_new_user()
returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, phone, name, pepites_balance)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'phone', new.phone, new.email),
      coalesce(new.raw_user_meta_data->>'name', 'Nouvel utilisateur'),
      500
    );
  return new;
end; $$;

-- Corrige aussi les comptes déjà créés avant ce correctif, si leur profil
-- contient encore l'e-mail interne factice à la place du vrai numéro.
update profiles p
set phone = u.raw_user_meta_data->>'phone'
from auth.users u
where p.id = u.id
  and u.raw_user_meta_data->>'phone' is not null
  and p.phone <> u.raw_user_meta_data->>'phone';
