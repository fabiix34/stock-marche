-- ============================================================
-- Authentification et permissions  (Supabase > SQL Editor, à exécuter une fois ; peut être relancé)
--
-- Modèle :
--   * Seuls l'administrateur et les responsables ont un compte.
--   * Les vendeurs n'ont pas de compte : ce sont des prénoms listés par marché (docs 'equipes/<marché>'),
--     choisis sur la caisse partagée, connectée par le responsable.
--   * admin       : tout.
--   * responsable : saisie, vente, bilan et équipe, limités à SES marchés (profiles.marches).
--
-- AVANT : Authentication > Sign In / Providers : désactive "Allow new users to sign up"
--         et "Confirm email". Users > Add user : crée TON compte (coche "Auto Confirm User").
-- APRÈS : remplace l'e-mail tout en bas puis relance la dernière requête.
-- ============================================================

-- 1. Profils : un par compte
create table if not exists profiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  email   text,
  nom     text,
  role    text not null default 'responsable',
  actif   boolean not null default true,
  marches text[] not null default '{}'      -- marchés (identifiants courts, ex. 'boissy') confiés au responsable
);
alter table profiles add column if not exists marches text[] not null default '{}';
-- Migration de l'ancien rôle 'vendeur' vers 'responsable'
alter table profiles drop constraint if exists profiles_role_check;
update profiles set role = 'responsable' where role = 'vendeur';
alter table profiles add constraint profiles_role_check check (role in ('admin','responsable'));
alter table profiles alter column role set default 'responsable';

-- 2. Fonctions de droits (security definer : lisent profiles sans boucle de règles)
create or replace function public.is_member() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from profiles where id = auth.uid() and actif) $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from profiles where id = auth.uid() and actif and role = 'admin') $$;

-- Droit d'écriture sur un document (p = chemin) :
--   admin : tout ; responsable : chargements, son brouillon et son marché du jour,
--   et pour SES marchés seulement : relevés, ventes et liste des vendeurs.
create or replace function public.can_write(p text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles pr
    where pr.id = auth.uid() and pr.actif and (
      pr.role = 'admin'
      or (pr.role = 'responsable' and (
            p like 'chargements/%'
         or p = 'brouillons/' || pr.id::text
         or p = 'etat/marche-' || pr.id::text
         or exists (
              select 1 from unnest(pr.marches) m
              where p ~ ('^(releves|ventes)/[0-9]{4}-[0-9]{2}-[0-9]{2}_' || m || '$')
                 or p = 'equipes/' || m)
      ))
    )
  ) $$;

-- 3. Chaque nouveau compte reçoit automatiquement un profil "responsable" (sans marché)
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
  $$ begin
       insert into profiles (id, email, role) values (new.id, new.email, 'responsable') on conflict (id) do nothing;
       return new;
     end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Règles d'accès (RLS)
alter table profiles enable row level security;
alter table docs     enable row level security;
alter table articles enable row level security;

drop policy if exists "acces appli" on docs;
drop policy if exists "acces appli" on articles;

drop policy if exists profiles_select on profiles;
drop policy if exists profiles_update on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- docs : lecture pour tout compte actif, sauf achats (admin) et brouillons des autres
drop policy if exists docs_select on docs;
drop policy if exists docs_insert on docs;
drop policy if exists docs_update on docs;
drop policy if exists docs_delete on docs;
create policy docs_select on docs for select to authenticated
  using (public.is_admin()
      or (public.is_member() and path not like 'achats/%' and path not like 'brouillons/%')
      or path = 'brouillons/' || auth.uid()::text);
create policy docs_insert on docs for insert to authenticated with check (public.can_write(path));
create policy docs_update on docs for update to authenticated using (public.can_write(path)) with check (public.can_write(path));
create policy docs_delete on docs for delete to authenticated using (public.can_write(path));

-- articles : lecture pour tout compte actif, écriture admin
drop policy if exists articles_select on articles;
drop policy if exists articles_write  on articles;
create policy articles_select on articles for select to authenticated using (public.is_member());
create policy articles_write  on articles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. TON compte administrateur (remplace l'e-mail par celui de ton compte Supabase)
insert into profiles (id, email, role)
  select id, email, 'admin' from auth.users where email = 'fabiolousadofl@gmail.com'
  on conflict (id) do update set role = 'admin', actif = true;
