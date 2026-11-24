-- ============================================================
-- Authentification et permissions  (Supabase > SQL Editor, à exécuter une fois)
--
-- AVANT : dans Supabase > Authentication :
--   1. Sign In / Providers > Email : activé, "Confirm email" désactivé
--   2. Sign In / Providers : désactive "Allow new users to sign up" (pas d'inscription libre)
--   3. Users > Add user : crée TON compte (e-mail + mot de passe, coche "Auto Confirm User")
-- APRÈS avoir exécuté ce script, remplace l'e-mail tout en bas puis relance la dernière requête.
-- ============================================================

-- 1. Profils : un par compte, avec un rôle ('admin' ou 'vendeur')
create table if not exists profiles (
  id    uuid primary key references auth.users(id) on delete cascade,
  email text,
  nom   text,
  role  text not null default 'vendeur' check (role in ('admin','vendeur')),
  actif boolean not null default true
);

-- 2. Fonctions de droits (security definer : lisent profiles sans boucle de règles)
create or replace function public.is_member() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from profiles where id = auth.uid() and actif) $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from profiles where id = auth.uid() and actif and role = 'admin') $$;

-- 3. Chaque nouveau compte reçoit automatiquement un profil "vendeur"
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
  $$ begin
       insert into profiles (id, email, role) values (new.id, new.email, 'vendeur') on conflict (id) do nothing;
       return new;
     end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Règles d'accès (RLS) : on supprime l'accès ouvert d'avant
alter table profiles enable row level security;
alter table docs     enable row level security;
alter table articles enable row level security;

drop policy if exists "acces appli" on docs;
drop policy if exists "acces appli" on articles;

-- profiles : chacun lit le sien, l'admin lit et modifie tout
drop policy if exists profiles_select on profiles;
drop policy if exists profiles_update on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- docs : tout compte actif lit (sauf achats et brouillons = admin) ;
--        l'admin écrit partout ; le vendeur écrit seulement les ventes et le marché du jour
drop policy if exists docs_select on docs;
drop policy if exists docs_insert on docs;
drop policy if exists docs_update on docs;
drop policy if exists docs_delete on docs;
create policy docs_select on docs for select to authenticated
  using (public.is_admin() or (public.is_member() and path not like 'achats/%' and path not like 'brouillons/%'));
create policy docs_insert on docs for insert to authenticated
  with check (public.is_admin() or (public.is_member() and (path like 'ventes/%' or path like 'etat/%')));
create policy docs_update on docs for update to authenticated
  using      (public.is_admin() or (public.is_member() and (path like 'ventes/%' or path like 'etat/%')))
  with check (public.is_admin() or (public.is_member() and (path like 'ventes/%' or path like 'etat/%')));
create policy docs_delete on docs for delete to authenticated
  using (public.is_admin());

-- articles : lecture pour tout compte actif, écriture admin
drop policy if exists articles_select on articles;
drop policy if exists articles_write  on articles;
create policy articles_select on articles for select to authenticated using (public.is_member());
create policy articles_write  on articles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. TON compte administrateur (remplace l'e-mail par celui de ton compte Supabase)
insert into profiles (id, email, role)
  select id, email, 'admin' from auth.users where email = 'fabiolousadofl@gmail.com'
  on conflict (id) do update set role = 'admin', actif = true;
