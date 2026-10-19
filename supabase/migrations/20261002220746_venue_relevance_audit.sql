-- Additive catalogue policy. No venues or dependent data are deleted.
begin;
create schema if not exists catalogue_relevance;
revoke all on schema catalogue_relevance from public,anon,authenticated;
grant usage on schema catalogue_relevance to service_role;
alter default privileges in schema catalogue_relevance revoke execute on functions from public;

create table catalogue_relevance.runs (
 id uuid primary key default gen_random_uuid(), classifier_version text not null,
 kind text not null check(kind in ('full','incremental')), summary jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create unique index relevance_incremental_run_unique on catalogue_relevance.runs(kind) where kind='incremental';
insert into catalogue_relevance.runs(classifier_version,kind) values('import-proposals-1.0.0','incremental');
create table catalogue_relevance.proposals (
 run_id uuid not null references catalogue_relevance.runs(id),
 venue_id uuid not null references public.venues(id) on delete cascade,
 fingerprint text not null, action text not null check(action in ('KEEP','DOWNRANK','HIDE','MOVE TO AKIDUERMO','REVIEW','CLOSED/ARCHIVE CANDIDATE')),
 relevance_class text not null, chain_name text, chain_kind text,
 recommendation_weight numeric not null check(recommendation_weight>0 and recommendation_weight<=1),
 confidence text not null check(confidence in ('low','medium','high')),
 source_categories text not null default '', reason text not null, evidence jsonb not null default '{}',
 status text not null default 'proposed' check(status in ('proposed','approved','rejected','superseded')),
 created_at timestamptz not null default now(), primary key(run_id,venue_id)
);
create index relevance_proposals_review_idx on catalogue_relevance.proposals(status,created_at desc,venue_id);
create index relevance_proposals_venue_idx on catalogue_relevance.proposals(venue_id,created_at desc);
create table catalogue_relevance.current (
 venue_id uuid primary key references public.venues(id) on delete cascade,
 run_id uuid references catalogue_relevance.runs(id), manual_override boolean not null default false,
 approved_at timestamptz not null default now(), approved_by text not null,
 fingerprint text not null
);
create table catalogue_relevance.decisions (
 id bigint generated always as identity primary key, venue_id uuid not null,
 run_id uuid, action text not null, actor text not null, reason text not null,
 before_image jsonb not null, after_image jsonb not null,
 created_at timestamptz not null default now()
);
create table catalogue_relevance.brands (
 name text primary key, pattern text not null, kind text not null, scope text not null,
 enabled boolean not null default true, rule_version text not null default '1.0.0'
);
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Burger King','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:burger king)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('McDonald''s','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:mc ?donald ?s?)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('KFC','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:kfc|kentucky fried chicken)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Starbucks','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:starbucks)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Domino''s','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:domino ?s?(?: pizza)?)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Telepizza','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:telepizza)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('100 Montaditos','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:(?:cerveceria )?100 montaditos)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Foster''s Hollywood','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:foster ?s? hollywood)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('VIPS','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:vips(?: smart)?)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Ginos','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:ginos)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Taco Bell','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:taco bell)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Subway','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:subway)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Pizza Hut','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:pizza hut)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('La Tagliatella','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:la tagliatella)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Goiko','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:goiko(?: grill)?)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Granier','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:(?:panaderia )?granier)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Papa John''s','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:papa john ?s?)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Santagloria','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:santagloria)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Popeyes','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:popeyes)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Rodilla','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:rodilla)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Honest Greens','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:honest greens)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Saona','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:(?:restaurante )?saona)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Aloha Poké','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:aloha poke)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Llaollao','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:llaollao)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('UDON','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:udon)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('The Good Burger','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:the good burger|tgb)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Grosso Napoletano','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:grosso napoletano)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Five Guys','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:five guys)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Jijonenca','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:(?:heladeria )?jijonenca)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Vivari','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:vivari)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Pizzería Carlos','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:pizzeria carlos)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Buenas Migas','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:buenas migas)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('La Sureña','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:(?:cerveceria )?la surena)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Muerde la Pasta','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:muerde la pasta)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Tierra Burrito','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:tierra burrito)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Tim Hortons','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:tim hortons)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Dunkin','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:dunkin(?: donuts)?)(?:\y|$)','hospitality','international');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Manolo Bakes','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:manolo bakes)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Lizarran','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:lizarran)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Pans & Company','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:pans(?: and)? company)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Ribs','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:ribs)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('La Mafia','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:la mafia)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('La Piemontesa','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:la piemontesa)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Wok to Walk','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:wok to walk)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('MasQMenos','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:mas ?q ?menos)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Enrique Tomás','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:enrique tomas)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Levaduramadre','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:levaduramadre)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Sushisom','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:sushisom)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Sushiko','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:sushiko)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Carl’s Jr','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:carl ?s? jr)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Volapié','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:(?:taberna )?volapie)(?:\y|$)','hospitality','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Go Fit','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:go fit)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Synergym','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:synergym)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('VivaGym','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:viva ?gym)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Basic-Fit','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:basic fit)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Brooklyn Fitboxing','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:brooklyn fitboxing)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('McFIT','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:mcfit)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Altafit','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:altafit)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Fitness Park','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:fitness park)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Anytime Fitness','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:anytime fitness)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Dreamfit','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:dreamfit)(?:\y|$)','fitness','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Yelmo','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:(?:cines? )?yelmo)(?:\y|$)','entertainment','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Cinesa','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:cinesa)(?:\y|$)','entertainment','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Kinépolis','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:(?:cines? )?kinepolis)(?:\y|$)','entertainment','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Ilusiona','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:ilusiona)(?:\y|$)','entertainment','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Ocine','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:ocine)(?:\y|$)','entertainment','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('NH Hotels','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:nh(?: collection)?)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Meliá','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:melia)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Barceló','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:barcelo)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Iberostar','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:iberostar)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('RIU','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:riu)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('H10','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:h10)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Vincci','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:vincci)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Sercotel','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:sercotel)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Eurostars','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:eurostars)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Ibis','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:ibis)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Paradores','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:parador(?: de)?)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('AC Hotels','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:ac hotel)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Hilton','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:hilton)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Marriott','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:marriott)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('Travelodge','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:travelodge)(?:\y|$)','hotel','national_or_regional');
insert into catalogue_relevance.brands(name,pattern,kind,scope) values('B&B Hotels','^(?:(?:hotel|hoteles|restaurante|restaurant|cafe|cafeteria|cerveceria|gimnasio|gym) )?(?:b b hotel)(?:\y|$)','hotel','national_or_regional');

alter table catalogue_relevance.runs enable row level security;
alter table catalogue_relevance.proposals enable row level security;
alter table catalogue_relevance.current enable row level security;
alter table catalogue_relevance.decisions enable row level security;
alter table catalogue_relevance.brands enable row level security;
revoke all on all tables in schema catalogue_relevance from public,anon,authenticated;
grant all on all tables in schema catalogue_relevance to service_role;
grant usage,select on all sequences in schema catalogue_relevance to service_role;

alter table public.venues
 add column discovery_enabled boolean not null default true,
 add column search_enabled boolean not null default true,
 add column recommendation_weight numeric not null default 1 check(recommendation_weight>0 and recommendation_weight<=1),
 add column relevance_class text,
 add column chain_name text,
 add column chain_kind text;
-- Published URLs are retained; search visibility and discovery weighting are separate policies.
insert into public.feature_flags(key,enabled,label_es,label_en) values
 ('venue_relevance',false,'Relevancia del catálogo','Venue catalogue relevance') on conflict(key) do nothing;
create or replace function public.venue_relevance_enabled()
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select enabled from public.feature_flags where key='venue_relevance'),false);
$$;
revoke all on function public.venue_relevance_enabled() from public;
grant execute on function public.venue_relevance_enabled() to anon,authenticated,service_role;
create or replace function catalogue_relevance.fingerprint(v public.venues)
returns text language sql immutable security invoker set search_path='' as $$
 select md5(jsonb_build_array(v.name,v.address,v.city_id,v.discovery_vertical,v.accommodation_type,v.status,v.location::text,v.verified)::text);
$$;
-- Table owners may edit their listing but cannot set admin relevance projections.
create or replace function catalogue_relevance.guard_projection()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in ('postgres','service_role','supabase_admin') then
  if TG_OP='INSERT' then
   if not new.discovery_enabled or not new.search_enabled or new.recommendation_weight<>1 or new.relevance_class is not null or new.chain_name is not null or new.chain_kind is not null then
    raise exception 'Classification is managed by administrators' using errcode='42501';
   end if;
  elsif row(new.discovery_enabled,new.search_enabled,new.recommendation_weight,new.relevance_class,new.chain_name,new.chain_kind)
    is distinct from row(old.discovery_enabled,old.search_enabled,old.recommendation_weight,old.relevance_class,old.chain_name,old.chain_kind) then
   raise exception 'Classification is managed by administrators' using errcode='42501';
  end if;
 end if;
 return new;
end;$$;
create trigger venues_relevance_projection_guard before insert or update on public.venues
 for each row execute function catalogue_relevance.guard_projection();

-- Incremental import proposals never overwrite approved/manual classifications.
-- This private trigger needs elevated privileges only to append the private queue.
-- It has no direct callable client API. Row authorization happens on the original
-- venue/CRM mutation; authenticated callers must have a valid auth.uid().
create or replace function catalogue_relevance.queue_import()
returns trigger language plpgsql security definer set search_path='' as $$
declare v public.venues; cats text; b catalogue_relevance.brands; run uuid;
 act text:='REVIEW'; cls text:='needs_review'; weight numeric:=1; why text;
begin
 if current_setting('role',true) in ('anon','authenticated') and auth.uid() is null then
  raise exception 'Authenticated import required' using errcode='42501';
 end if;
 if TG_TABLE_NAME='venues' then select * into v from public.venues where id=new.id;
 else select * into v from public.venues where id=new.venue_id; end if;
 if v.status<>'published' then return new; end if;
 select string_agg(distinct public.venue_search_normalize(s.category),' | ' order by public.venue_search_normalize(s.category)) into cats
 from public.crm_catalogue_venues l join public.crm_company_records c on c.workspace_id=l.workspace_id and c.id=l.lead_id and c.deleted_at is null
 join akiduermo.source_categories s on s.external_id=coalesce(nullif(c.data->>'externalId',''),c.id)
 where l.venue_id=v.id;
 select * into b from catalogue_relevance.brands
 where enabled and public.venue_search_normalize(v.name) ~ pattern order by length(name) desc limit 1;
 why:='New/edited listing: source and name require review; existing discovery behaviour preserved.';
 if length(replace(public.venue_search_normalize(v.name),' ',''))<=2 then why:='Very short name: review without suppressing current visibility.';
 elsif v.discovery_vertical='accommodation' then act:='KEEP';cls:='accommodation';why:='Existing accommodation vertical preserved.';
 elsif public.venue_search_normalize(v.name) ~ '\y(hotel|hostal|hostel|albergue|aparthotel|apartamento|apartamentos|casa rural|camping|pension)\y' then
  why:='Accommodation-name conflict: check for a restaurant at lodging premises before moving.';
 elsif b.kind='hospitality' and coalesce(cats,'') ~ '\y(bar|restaurant|restaurante|restauracion|cafe|cafeteria|pub|fast food|ice cream)\y'
  and public.venue_search_normalize(v.name) not like '%bodegoia%'
  and v.name !~ '[,;]' then
  act:='DOWNRANK';cls:='hospitality_chain';weight:=case when b.scope='international' then 0.35 else 0.65 end;
  why:='Known brand pattern and hospitality source; searchable with proposed lower recommendation weighting.';
 elsif cats in ('sports centre','fitness centre') then cls:='sports_activity';why:='Sports/fitness source: establish bookable experience versus general infrastructure.';
 elsif cats in ('townhall','hospital','pharmacy','college','school','university','commercial','building') then
  cls:='non_core_service';why:='Non-core source: verify hospitality or heritage offering before hiding.';
 elsif cats in ('museum','attraction','zoo','aquarium','theme park','water park','planetarium','monastery') then
  act:='KEEP';cls:='attraction';why:='Tourism source supports discovery.';
 elsif cats in ('theatre','arts centre','gallery','cinema','music venue','exhibition centre','events venue') then
  act:='KEEP';cls:='culture_entertainment';why:='Culture/entertainment source supports discovery.';
 elsif coalesce(cats,'') ~ '\y(bar|restaurant|restaurante|restauracion|cafe|cafeteria|pub|fast food|ice cream|nightclub)\y' then
  act:='KEEP';cls:='core_venue';why:='Hospitality source supports discovery; verify any name conflict during review.';
 end if;
 select id into run from catalogue_relevance.runs where kind='incremental' order by created_at limit 1;
 if run is null then
  insert into catalogue_relevance.runs(classifier_version,kind) values('import-proposals-1.0.0','incremental') returning id into run;
 end if;
 insert into catalogue_relevance.proposals(run_id,venue_id,fingerprint,action,relevance_class,chain_name,chain_kind,recommendation_weight,confidence,source_categories,reason,evidence)
 values(run,v.id,catalogue_relevance.fingerprint(v),act,cls,b.name,b.kind,weight,case when act='REVIEW' then 'low' else 'medium' end,coalesce(cats,''),why,jsonb_build_object('method','import_trigger'))
 on conflict(run_id,venue_id) do update set fingerprint=excluded.fingerprint,action=excluded.action,
 relevance_class=excluded.relevance_class,chain_name=excluded.chain_name,chain_kind=excluded.chain_kind,
 recommendation_weight=excluded.recommendation_weight,source_categories=excluded.source_categories,
 reason=excluded.reason,status='proposed',created_at=now();
 return new;
end;$$;
revoke all on all functions in schema catalogue_relevance from public,anon,authenticated;
grant execute on function catalogue_relevance.fingerprint(public.venues) to service_role;
create trigger venues_relevance_import_queue after insert or update of name,address,location,city_id,discovery_vertical,accommodation_type,status on public.venues
 for each row execute function catalogue_relevance.queue_import();
create trigger crm_venue_relevance_import_queue after insert or update of venue_id on public.crm_catalogue_venues
 for each row execute function catalogue_relevance.queue_import();

-- Service-only endpoints. The web server authenticates the actor and verifies
-- platform role; the database independently verifies the supplied actor too.
create or replace function public.admin_venue_relevance_page(p_actor uuid,p_search text default '',p_action text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare total bigint; result jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor and app_role='administrator') then raise exception 'Administrator required' using errcode='42501';end if;
 if p_offset<0 or p_offset>1000000 or length(p_search)>160 or p_action not in ('','KEEP','DOWNRANK','HIDE','MOVE TO AKIDUERMO','REVIEW','CLOSED/ARCHIVE CANDIDATE') then raise exception 'Invalid filter';end if;
 select count(*) into total from (
  select distinct on(p.venue_id) p.venue_id,p.action,p.status from catalogue_relevance.proposals p order by p.venue_id,p.created_at desc,p.run_id
 ) p join public.venues v on v.id=p.venue_id where p.status='proposed'
 and (p_action='' or p.action=p_action) and (p_search='' or concat_ws(' ',v.name,v.address) ilike '%'||p_search||'%');
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (
  select v.id,v.name,v.slug,v.address,p.action,p.relevance_class,p.chain_name,p.confidence,p.source_categories,p.reason,p.fingerprint,
   (catalogue_relevance.fingerprint(v)<>p.fingerprint) stale,
   coalesce(c.manual_override,false) manual_override
  from (select distinct on(p.venue_id) p.* from catalogue_relevance.proposals p order by p.venue_id,p.created_at desc,p.run_id) p
  join public.venues v on v.id=p.venue_id left join catalogue_relevance.current c on c.venue_id=v.id
  where p.status='proposed' and (p_action='' or p.action=p_action)
   and (p_search='' or concat_ws(' ',v.name,v.address) ilike '%'||p_search||'%')
  order by p.created_at desc,v.id limit 40 offset p_offset
 )r;
 return jsonb_build_object('total',total,'rows',result);
end;$$;
create or replace function public.admin_resolve_venue_relevance(p_actor uuid,p_venue uuid,p_action text,p_weight numeric,p_fingerprint text,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.venues; p catalogue_relevance.proposals; before_data jsonb; after_data jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor and app_role='administrator') then raise exception 'Administrator required' using errcode='42501';end if;
 if p_action not in ('KEEP','DOWNRANK','HIDE') or p_weight is null or p_weight<=0 or p_weight>1 or length(trim(p_reason)) not between 10 and 1000 then raise exception 'Invalid decision';end if;
 select * into v from public.venues where id=p_venue for update;
 if not found then raise exception 'Venue unavailable';end if;
 if catalogue_relevance.fingerprint(v)<>p_fingerprint then raise exception 'Venue changed: refresh review' using errcode='40001';end if;
 select * into p from catalogue_relevance.proposals where venue_id=p_venue and fingerprint=p_fingerprint and status='proposed' order by created_at desc,run_id limit 1 for update;
 if not found then raise exception 'Proposal unavailable: refresh review' using errcode='40001';end if;
 before_data:=jsonb_build_object('discovery_enabled',v.discovery_enabled,'search_enabled',v.search_enabled,'recommendation_weight',v.recommendation_weight,'relevance_class',v.relevance_class,'chain_name',v.chain_name,'chain_kind',v.chain_kind);
 update public.venues set discovery_enabled=(p_action<>'HIDE'),search_enabled=(p_action<>'HIDE'),recommendation_weight=case when p_action='DOWNRANK' then p_weight else 1 end,
  relevance_class=p.relevance_class,chain_name=p.chain_name,chain_kind=p.chain_kind where id=p_venue;
 select jsonb_build_object('discovery_enabled',discovery_enabled,'search_enabled',search_enabled,'recommendation_weight',recommendation_weight,'relevance_class',relevance_class,'chain_name',chain_name,'chain_kind',chain_kind) into after_data from public.venues where id=p_venue;
 insert into catalogue_relevance.decisions(venue_id,run_id,action,actor,reason,before_image,after_image) values(p_venue,p.run_id,p_action,p_actor::text,p_reason,before_data,after_data);
 insert into catalogue_relevance.current(venue_id,run_id,manual_override,approved_by,fingerprint) values(p_venue,p.run_id,true,p_actor::text,p_fingerprint)
 on conflict(venue_id) do update set run_id=excluded.run_id,manual_override=true,approved_at=now(),approved_by=excluded.approved_by,fingerprint=excluded.fingerprint;
 update catalogue_relevance.proposals set status=case when run_id=p.run_id then 'approved' else 'superseded' end where venue_id=p_venue and status='proposed';
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.admin_venue_relevance_page(uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.admin_resolve_venue_relevance(uuid,uuid,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.admin_venue_relevance_page(uuid,text,text,integer) to service_role;
grant execute on function public.admin_resolve_venue_relevance(uuid,uuid,text,numeric,text,text) to service_role;
commit;
