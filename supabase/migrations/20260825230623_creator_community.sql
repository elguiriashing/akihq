begin;
create type creator_profile_state as enum ('draft','published','suspended');
create type creator_verification_state as enum ('unverified','pending','verified','rejected');
create table creator_profiles (
 profile_id uuid primary key references profiles(id) on delete cascade,
 slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 display_name text not null check (char_length(display_name) between 2 and 100),
 headline_es text check (headline_es is null or char_length(headline_es)<=180),
 headline_en text check (headline_en is null or char_length(headline_en)<=180),
 bio_es text not null check (char_length(bio_es) between 40 and 4000),
 bio_en text check (bio_en is null or char_length(bio_en) between 40 and 4000),
 locality text check (locality is null or char_length(locality)<=120),
 province text check (province is null or char_length(province)<=120),
 avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
 cover_url text check (cover_url is null or cover_url ~ '^https://'),
 website_url text check (website_url is null or website_url ~ '^https://'),
 instagram_url text check (instagram_url is null or instagram_url ~ '^https://'),
 youtube_url text check (youtube_url is null or youtube_url ~ '^https://'),
 state creator_profile_state not null default 'draft',
 verification_state creator_verification_state not null default 'unverified',
 verification_note text, verified_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table creator_categories (
 creator_profile_id uuid not null references creator_profiles(profile_id) on delete cascade,
 category_id uuid not null references categories(id) on delete cascade,
 primary key(creator_profile_id,category_id)
);
create table creator_reviews (
 id uuid primary key default gen_random_uuid(),
 creator_profile_id uuid not null references creator_profiles(profile_id) on delete cascade,
 reviewer_id uuid not null references profiles(id) on delete cascade,
 rating smallint not null check(rating between 1 and 5),
 body text not null check(char_length(body) between 20 and 1200),
 state moderation_state not null default 'pending',
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 unique(creator_profile_id,reviewer_id), check(creator_profile_id<>reviewer_id)
);
alter table events add column creator_profile_id uuid references creator_profiles(profile_id) on delete set null;
alter table event_submissions add column creator_profile_id uuid references creator_profiles(profile_id) on delete set null;
create index events_creator_profile_idx on events(creator_profile_id,status,created_at desc);
create index creator_profiles_directory_idx on creator_profiles(state,verification_state,updated_at desc);
create index creator_reviews_profile_idx on creator_reviews(creator_profile_id,state,created_at desc);
alter table creator_profiles enable row level security;
alter table creator_categories enable row level security;
alter table creator_reviews enable row level security;
create policy creator_profiles_public_read on creator_profiles for select using(state='published' or profile_id=(select auth.uid()) or has_platform_role(array['moderator','administrator']::app_role[]));
create policy creator_profiles_owner_insert on creator_profiles for insert to authenticated with check(profile_id=(select auth.uid()) and verification_state='unverified');
create policy creator_profiles_owner_update on creator_profiles for update to authenticated using(profile_id=(select auth.uid())) with check(profile_id=(select auth.uid()) and verification_state in ('unverified','pending','rejected'));
create policy creator_profiles_staff_update on creator_profiles for update to authenticated using(has_platform_role(array['moderator','administrator']::app_role[])) with check(has_platform_role(array['moderator','administrator']::app_role[]));
create policy creator_categories_public_read on creator_categories for select using(exists(select 1 from creator_profiles cp where cp.profile_id=creator_profile_id and (cp.state='published' or cp.profile_id=(select auth.uid()))));
create policy creator_categories_owner_write on creator_categories for all to authenticated using(creator_profile_id=(select auth.uid())) with check(creator_profile_id=(select auth.uid()));
create policy creator_reviews_public_read on creator_reviews for select using(state='approved' or reviewer_id=(select auth.uid()) or has_platform_role(array['moderator','administrator']::app_role[]));
create policy creator_reviews_owner_insert on creator_reviews for insert to authenticated with check(reviewer_id=(select auth.uid()) and creator_profile_id<>(select auth.uid()));
create or replace function request_creator_verification() returns void language plpgsql security invoker set search_path=public as $$
begin
 update creator_profiles set verification_state='pending',verification_note=null,updated_at=now()
 where profile_id=(select auth.uid()) and state='published' and verification_state in ('unverified','rejected');
 if not found then raise exception 'published creator profile required'; end if;
end; $$;
create or replace function prepare_creator_submission() returns trigger language plpgsql security definer set search_path=public as $$
begin
 new.creator_profile_id:=(select profile_id from creator_profiles where profile_id=new.submitter_id and state='published');
 return new;
end; $$;
create trigger event_submission_creator_before_insert before insert on event_submissions for each row execute function prepare_creator_submission();
create or replace function link_published_creator_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.published_event_id is not null and new.creator_profile_id is not null then
  update events set creator_profile_id=new.creator_profile_id where id=new.published_event_id and creator_profile_id is null;
 end if;
 return new;
end; $$;
create trigger event_submission_creator_after_publish after insert or update of published_event_id on event_submissions for each row execute function link_published_creator_event();
insert into categories(id,slug,name_es,name_en) values
(gen_random_uuid(),'nightlife','Vida nocturna','Nightlife'),(gen_random_uuid(),'beach','Playa','Beach'),
(gen_random_uuid(),'family','Familia','Family'),(gen_random_uuid(),'singles','Solteros','Singles'),
(gen_random_uuid(),'wellness','Bienestar','Wellness'),(gen_random_uuid(),'sports','Deporte','Sports'),
(gen_random_uuid(),'nature','Naturaleza','Nature'),(gen_random_uuid(),'art','Arte','Art'),
(gen_random_uuid(),'literature','Literatura y poesía','Literature and poetry'),(gen_random_uuid(),'tradition','Tradición','Tradition'),
(gen_random_uuid(),'shopping','Compras','Shopping'),(gen_random_uuid(),'services','Servicios','Services'),
(gen_random_uuid(),'institution','Instituciones','Institutions'),(gen_random_uuid(),'seasonal','Temporada y fiestas','Seasonal and holidays')
on conflict(slug) do update set name_es=excluded.name_es,name_en=excluded.name_en;
grant select on creator_profiles,creator_categories,creator_reviews to anon,authenticated;
grant insert,update on creator_profiles to authenticated;
grant insert,update,delete on creator_categories to authenticated;
grant insert on creator_reviews to authenticated;
revoke all on function request_creator_verification() from public,anon;
grant execute on function request_creator_verification() to authenticated;
revoke all on function prepare_creator_submission() from public,anon,authenticated;
revoke all on function link_published_creator_event() from public,anon,authenticated;

create or replace function moderate_creator_profile(
  p_profile_id uuid,
  p_decision text,
  p_reason text
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not has_platform_role(array['moderator','administrator']::app_role[]) then raise exception 'moderator role required'; end if;
  if p_decision not in ('verified','rejected') or char_length(trim(p_reason))<3 then raise exception 'invalid creator decision'; end if;
  update creator_profiles
  set verification_state=p_decision::creator_verification_state,
      verification_note=trim(p_reason),
      verified_at=case when p_decision='verified' then now() else null end,
      updated_at=now()
  where profile_id=p_profile_id and verification_state='pending';
  if not found then raise exception 'creator request not pending'; end if;
  insert into moderation_actions(actor_id,action,target_type,target_id,reason)
  values(auth.uid(),p_decision,'creator_profile',p_profile_id,trim(p_reason));
end; $$;
revoke all on function moderate_creator_profile(uuid,text,text) from public,anon;
grant execute on function moderate_creator_profile(uuid,text,text) to authenticated;

commit;
