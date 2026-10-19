begin;

-- Canonical, evolvable behaviour catalogue. Text keys intentionally replace a
-- PostgreSQL enum so adding a client event does not require rewriting rows.
create table behaviour_event_catalogue (
  name text primary key check (name ~ '^[a-z][a-z0-9_]{2,63}$'),
  description text not null check (char_length(description) between 8 and 500),
  default_strength numeric(5,2) not null default 0 check (default_strength between -10 and 10),
  privacy_class text not null check (privacy_class in ('essential','analytics','personalisation','marketing')),
  high_value boolean not null default false,
  retention_days integer not null default 180 check (retention_days between 1 and 2555),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into behaviour_event_catalogue(name,description,default_strength,privacy_class,high_value,retention_days) values
  ('event_impression','An event card was meaningfully visible to the visitor.',0,'analytics',false,90),
  ('event_opened','The visitor opened an event detail page.',0.60,'personalisation',false,180),
  ('event_skipped','A meaningfully visible event was passed without interaction.',-0.15,'personalisation',false,90),
  ('event_quick_exit','The visitor left an event shortly after opening it.',-0.80,'personalisation',false,180),
  ('entity_view_duration','Meaningful visible dwell time for a supported entity.',0,'personalisation',false,90),
  ('event_saved','The visitor saved an event.',2.40,'personalisation',false,365),
  ('event_unsaved','The visitor removed a saved event.',-0.70,'personalisation',false,180),
  ('event_shared','The visitor shared an event.',2.20,'personalisation',false,365),
  ('event_going','The visitor marked that they are going.',4.00,'personalisation',false,365),
  ('event_not_interested','The visitor explicitly rejected an event.',-4.50,'personalisation',false,365),
  ('event_directions_clicked','The visitor requested directions for an event.',3.50,'personalisation',false,365),
  ('event_ticket_clicked','The visitor opened an event ticket destination.',3.20,'personalisation',false,365),
  ('event_ticket_purchased','A trusted integration verified an event ticket purchase.',7.50,'essential',true,730),
  ('event_booking_clicked','The visitor opened an event booking destination.',3.20,'personalisation',false,365),
  ('event_booking_completed','A trusted integration verified an event booking.',7.50,'essential',true,730),
  ('event_checked_in','AkiPasa verified an event or venue check-in.',9.00,'essential',true,730),
  ('event_calendar_added','The visitor added an event to a calendar.',3.60,'personalisation',false,365),
  ('event_rating_submitted','The visitor submitted an event rating.',4.00,'personalisation',false,730),
  ('event_review_submitted','The visitor submitted an event review.',4.50,'personalisation',false,730),
  ('event_photo_uploaded','The visitor uploaded an event photo.',4.50,'personalisation',false,730),
  ('event_comment_posted','The visitor commented on an event.',2.50,'personalisation',false,365),
  ('event_promoted_clicked','The visitor opened a clearly labelled promoted event.',0.70,'analytics',false,180),
  ('venue_impression','A venue card or map result was meaningfully visible.',0,'analytics',false,90),
  ('venue_opened','The visitor opened a venue detail page.',0.60,'personalisation',false,180),
  ('venue_followed','The visitor followed a venue.',2.80,'personalisation',false,365),
  ('venue_unfollowed','The visitor unfollowed a venue.',-1.00,'personalisation',false,180),
  ('venue_shared','The visitor shared a venue.',2.00,'personalisation',false,365),
  ('venue_directions_clicked','The visitor requested directions for a venue.',3.30,'personalisation',false,365),
  ('venue_phone_clicked','The visitor called a venue.',2.80,'personalisation',false,365),
  ('venue_website_clicked','The visitor opened a venue website.',2.20,'personalisation',false,365),
  ('venue_instagram_clicked','The visitor opened a venue Instagram profile.',1.80,'personalisation',false,365),
  ('venue_whatsapp_clicked','The visitor opened a venue WhatsApp conversation.',2.80,'personalisation',false,365),
  ('venue_hidden','The visitor requested that a venue no longer be shown.',-8.00,'personalisation',false,730),
  ('search_performed','The visitor submitted a discovery search or filter set.',1.00,'personalisation',false,90),
  ('search_result_clicked','The visitor opened a result from a search.',1.40,'personalisation',false,180),
  ('search_abandoned','A search ended without a result interaction.',-0.10,'analytics',false,30),
  ('feed_scrolled','A coarse feed depth milestone was reached.',0,'analytics',false,30),
  ('feed_refreshed','The visitor explicitly refreshed a discovery feed.',0.10,'analytics',false,30),
  ('filter_changed','A discovery filter changed and revealed current intent.',0.40,'personalisation',false,90),
  ('map_opened','The visitor opened a discovery map.',0.20,'analytics',false,90),
  ('map_pin_clicked','The visitor selected a map entity.',0.60,'personalisation',false,180),
  ('notification_opened','The visitor opened an AkiPasa notification.',0.80,'personalisation',false,180),
  ('notification_dismissed','The visitor dismissed an AkiPasa notification.',-0.30,'personalisation',false,90),
  ('email_clicked','The visitor followed an AkiPasa email link.',0.80,'marketing',false,180),
  ('passport_progressed','A verified check-in progressed a Passport.',5.00,'essential',true,730),
  ('passport_completed','A verified check-in completed a Passport.',7.00,'essential',true,730),
  ('recommendation_clicked','The visitor opened an explicitly recommended entity.',0.90,'personalisation',false,180),
  ('promotion_clicked','The visitor opened a labelled commercial placement.',0.70,'analytics',false,180);

create table personalisation_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,
  analytics_enabled boolean not null default false,
  personalisation_enabled boolean not null default false,
  marketing_enabled boolean not null default false,
  location_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table user_event_preferences (
  profile_id uuid not null references profiles(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  state text not null check (state in ('going','not_interested')),
  reason text check (reason is null or reason in ('not_my_thing','too_far','too_expensive','wrong_time','already_seen','hide_venue','other')),
  updated_at timestamptz not null default now(),
  primary key (profile_id,event_id)
);
create index user_event_preferences_event_state_idx on user_event_preferences(event_id,state);

create table preference_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id) on delete cascade,
  anonymous_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or anonymous_id is not null)
);

create table behaviour_events (
  event_id uuid primary key,
  schema_version smallint not null default 1 check (schema_version between 1 and 32),
  event_type text not null references behaviour_event_catalogue(name),
  profile_id uuid references profiles(id) on delete set null,
  anonymous_id uuid not null,
  session_id uuid not null,
  entity_type text check (entity_type is null or entity_type in ('event','venue','category','artist','organiser','passport','community_post','notification','search','feed')),
  entity_id uuid,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  surface text not null check (surface ~ '^[a-z][a-z0-9_]{1,63}$'),
  position integer check (position is null or position between 0 and 500),
  recommendation_request_id uuid,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  verified boolean not null default false,
  trust_score numeric(4,3) not null default 0.500 check (trust_score between 0 and 1)
);
create index behaviour_events_profile_time_idx on behaviour_events(profile_id,occurred_at desc) where profile_id is not null;
create index behaviour_events_anonymous_time_idx on behaviour_events(anonymous_id,occurred_at desc);
create index behaviour_events_session_received_idx on behaviour_events(session_id,received_at desc);
create index behaviour_events_entity_time_idx on behaviour_events(entity_type,entity_id,occurred_at desc) where entity_id is not null;
create index behaviour_events_recommendation_idx on behaviour_events(recommendation_request_id) where recommendation_request_id is not null;

create table user_preference_signals (
  preference_profile_id uuid not null references preference_profiles(id) on delete cascade,
  dimension text not null check (dimension in ('category','subcategory','venue','artist','organiser','price','distance','time','weekday','planning_horizon','search_intent')),
  key text not null check (char_length(key) between 1 and 160),
  short_term_score numeric(7,5) not null default 0 check (short_term_score between -1 and 1),
  long_term_score numeric(7,5) not null default 0 check (long_term_score between -1 and 1),
  confidence numeric(7,5) not null default 0 check (confidence between 0 and 1),
  positive_evidence numeric(12,4) not null default 0,
  negative_evidence numeric(12,4) not null default 0,
  last_signal_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (preference_profile_id,dimension,key)
);
create index user_preference_signals_dimension_idx on user_preference_signals(preference_profile_id,dimension,confidence desc);

create table ranking_configs (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  version integer not null check (version > 0),
  active boolean not null default false,
  weights jsonb not null check (jsonb_typeof(weights) = 'object'),
  exploration_ratio numeric(4,3) not null default 0.150 check (exploration_ratio between 0 and 0.5),
  sponsored_multiplier numeric(4,3) not null default 1.120 check (sponsored_multiplier between 1 and 2),
  sponsored_minimum_relevance numeric(7,5) not null default 0.250 check (sponsored_minimum_relevance between 0 and 1),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique(key,version)
);
create unique index ranking_configs_one_active_idx on ranking_configs(key) where active;

insert into ranking_configs(key,version,active,weights,exploration_ratio,sponsored_multiplier,sponsored_minimum_relevance)
values ('weighted_ranker',1,true,jsonb_build_object('category_affinity',0.24,'venue_affinity',0.18,'price_affinity',0.08,'distance_relevance',0.15,'temporal_relevance',0.13,'quality',0.10,'freshness',0.06,'session_intent',0.16,'repetition_penalty',0.12,'negative_affinity',0.28),0.15,1.12,0.25);

create table recommendation_requests (
  id uuid primary key default gen_random_uuid(),
  preference_profile_id uuid references preference_profiles(id) on delete set null,
  surface text not null check (surface ~ '^[a-z][a-z0-9_]{1,63}$'),
  model text not null,
  model_version text not null,
  ranking_version integer not null,
  feature_version integer not null,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  experiment_assignments jsonb not null default '{}'::jsonb check (jsonb_typeof(experiment_assignments) = 'object'),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  result_count integer not null default 0 check (result_count >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  fallback_used boolean not null default false,
  created_at timestamptz not null default now()
);
create index recommendation_requests_profile_time_idx on recommendation_requests(preference_profile_id,created_at desc);

alter table behaviour_events add constraint behaviour_events_recommendation_fk foreign key (recommendation_request_id) references recommendation_requests(id) on delete set null;

create table recommendation_items (
  recommendation_request_id uuid not null references recommendation_requests(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  occurrence_id uuid references event_occurrences(id) on delete set null,
  position integer not null check (position between 0 and 500),
  candidate_source text not null,
  organic_score numeric(10,6) not null,
  final_score numeric(10,6) not null,
  score_components jsonb not null default '{}'::jsonb check (jsonb_typeof(score_components) = 'object'),
  reason_codes text[] not null default '{}',
  sponsored boolean not null default false,
  exploration boolean not null default false,
  primary key (recommendation_request_id,event_id,occurrence_id)
);
create index recommendation_items_event_idx on recommendation_items(event_id,recommendation_request_id);

create table experiments (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  enabled boolean not null default false,
  allocation jsonb not null default '{"control":1}'::jsonb check (jsonb_typeof(allocation) = 'object'),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table experiment_assignments (
  experiment_key text not null references experiments(key) on delete cascade,
  preference_profile_id uuid not null references preference_profiles(id) on delete cascade,
  variant text not null check (variant ~ '^[a-z][a-z0-9_]{1,63}$'),
  assigned_at timestamptz not null default now(),
  primary key (experiment_key,preference_profile_id)
);

alter table behaviour_event_catalogue enable row level security;
alter table personalisation_settings enable row level security;
alter table user_event_preferences enable row level security;
alter table preference_profiles enable row level security;
alter table behaviour_events enable row level security;
alter table user_preference_signals enable row level security;
alter table ranking_configs enable row level security;
alter table recommendation_requests enable row level security;
alter table recommendation_items enable row level security;
alter table experiments enable row level security;
alter table experiment_assignments enable row level security;

create policy behaviour_catalogue_read on behaviour_event_catalogue for select to anon,authenticated using (enabled);
create policy personalisation_settings_own on personalisation_settings for all to authenticated using ((select auth.uid())=profile_id) with check ((select auth.uid())=profile_id);
create policy user_event_preferences_own on user_event_preferences for all to authenticated using ((select auth.uid())=profile_id) with check ((select auth.uid())=profile_id);
create policy preference_profiles_own_read on preference_profiles for select to authenticated using ((select auth.uid())=profile_id);
create policy behaviour_events_own_read on behaviour_events for select to authenticated using ((select auth.uid())=profile_id);
create policy user_preference_signals_own_read on user_preference_signals for select to authenticated using (exists(select 1 from preference_profiles p where p.id=preference_profile_id and p.profile_id=(select auth.uid())));
create policy ranking_configs_active_read on ranking_configs for select to anon,authenticated using (active);
create policy recommendation_requests_own_read on recommendation_requests for select to authenticated using (exists(select 1 from preference_profiles p where p.id=preference_profile_id and p.profile_id=(select auth.uid())));
create policy recommendation_items_own_read on recommendation_items for select to authenticated using (exists(select 1 from recommendation_requests r join preference_profiles p on p.id=r.preference_profile_id where r.id=recommendation_request_id and p.profile_id=(select auth.uid())));
create policy experiments_enabled_read on experiments for select to anon,authenticated using (enabled);
create policy experiment_assignments_own_read on experiment_assignments for select to authenticated using (exists(select 1 from preference_profiles p where p.id=preference_profile_id and p.profile_id=(select auth.uid())));

create or replace function jsonb_has_forbidden_behaviour_key(p_value jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
declare v_key text; v_child jsonb;
begin
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value)='object' then
    for v_key,v_child in select key,value from jsonb_each(p_value) loop
      if lower(v_key)=any(array['email','phone','name','full_name','ip','ip_address','latitude','longitude','lat','lng','address','precise_location','user_agent']) then return true; end if;
      if jsonb_has_forbidden_behaviour_key(v_child) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v_child in select value from jsonb_array_elements(p_value) loop if jsonb_has_forbidden_behaviour_key(v_child) then return true; end if; end loop;
  end if;
  return false;
end; $$;

create or replace function upsert_preference_signal(p_preference_profile uuid,p_dimension text,p_key text,p_delta numeric,p_occurred_at timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare v_delta numeric:=greatest(-1.0,least(1.0,p_delta/5.0));
begin
  if p_key is null or char_length(trim(p_key))=0 then return; end if;
  insert into user_preference_signals(preference_profile_id,dimension,key,short_term_score,long_term_score,confidence,positive_evidence,negative_evidence,last_signal_at)
  values(p_preference_profile,p_dimension,left(trim(p_key),160),v_delta,v_delta*0.35,least(0.99,1-exp(-abs(p_delta)/8)),greatest(p_delta,0),greatest(-p_delta,0),p_occurred_at)
  on conflict(preference_profile_id,dimension,key) do update set
    short_term_score=greatest(-1,least(1,user_preference_signals.short_term_score*exp(-greatest(0,extract(epoch from (p_occurred_at-user_preference_signals.last_signal_at)))/604800)+v_delta)),
    long_term_score=greatest(-1,least(1,user_preference_signals.long_term_score*exp(-greatest(0,extract(epoch from (p_occurred_at-user_preference_signals.last_signal_at)))/7776000)+(v_delta*0.20))),
    positive_evidence=user_preference_signals.positive_evidence+greatest(p_delta,0),negative_evidence=user_preference_signals.negative_evidence+greatest(-p_delta,0),
    confidence=least(0.99,1-exp(-(user_preference_signals.positive_evidence+user_preference_signals.negative_evidence+abs(p_delta))/8)),
    last_signal_at=greatest(user_preference_signals.last_signal_at,p_occurred_at),updated_at=now();
end; $$;

create or replace function resolve_preference_profile(p_profile uuid,p_anonymous uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_profile is not null then
    select id into v_id from preference_profiles where profile_id=p_profile;
    if v_id is not null then return v_id; end if;
    select id into v_id from preference_profiles where anonymous_id=p_anonymous and profile_id is null for update;
    if v_id is not null then update preference_profiles set profile_id=p_profile,updated_at=now() where id=v_id; return v_id; end if;
    insert into preference_profiles(profile_id,anonymous_id) values(p_profile,p_anonymous) returning id into v_id; return v_id;
  end if;
  select id into v_id from preference_profiles where anonymous_id=p_anonymous and profile_id is null;
  if v_id is null then insert into preference_profiles(anonymous_id) values(p_anonymous) returning id into v_id; end if;
  return v_id;
end; $$;

create or replace function apply_behaviour_signal(p_event_id uuid,p_preference_profile uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_event behaviour_events%rowtype; v_weight numeric; v_repeats integer; v_category text; v_venue uuid; v_price integer; v_duration integer;
begin
  select * into v_event from behaviour_events where event_id=p_event_id;
  select default_strength into v_weight from behaviour_event_catalogue where name=v_event.event_type;
  if v_event.event_type='entity_view_duration' then v_duration:=least(120000,greatest(0,coalesce((v_event.metadata->>'duration_ms')::integer,0))); v_weight:=case when v_duration<1500 then -0.25 when v_duration<10000 then 0.25 when v_duration<30000 then 0.70 else 1.20 end; end if;
  if v_weight=0 then return; end if;
  select count(*) into v_repeats from behaviour_events b where b.event_id<>v_event.event_id and b.event_type=v_event.event_type and b.anonymous_id=v_event.anonymous_id and b.entity_type is not distinct from v_event.entity_type and b.entity_id is not distinct from v_event.entity_id and b.occurred_at>v_event.occurred_at-interval '24 hours';
  v_weight:=v_weight/sqrt(1+least(v_repeats,24));
  if v_event.entity_type='event' and v_event.entity_id is not null then
    select c.slug,e.venue_id,e.price_cents into v_category,v_venue,v_price from events e join categories c on c.id=e.category_id where e.id=v_event.entity_id;
    perform upsert_preference_signal(p_preference_profile,'category',v_category,v_weight,v_event.occurred_at);
    perform upsert_preference_signal(p_preference_profile,'venue',v_venue::text,v_weight*0.65,v_event.occurred_at);
    perform upsert_preference_signal(p_preference_profile,'price',case when v_price=0 then 'free' when v_price<1000 then 'under_10' when v_price<2000 then 'under_20' else 'premium' end,v_weight*0.45,v_event.occurred_at);
  elsif v_event.entity_type='venue' and v_event.entity_id is not null then perform upsert_preference_signal(p_preference_profile,'venue',v_event.entity_id::text,v_weight,v_event.occurred_at); end if;
end; $$;

create or replace function ingest_behaviour_batch(p_events jsonb,p_profile uuid,p_anonymous uuid,p_session uuid,p_personalisation_allowed boolean default false,p_verified boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item jsonb; v_catalogue behaviour_event_catalogue%rowtype; v_event_id uuid; v_type text; v_entity_type text; v_entity_id uuid; v_context jsonb; v_metadata jsonb; v_occurred timestamptz; v_pref uuid; v_inserted integer; v_accepted integer:=0; v_duplicates integer:=0;
begin
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events) not between 1 and 25 or p_anonymous is null or p_session is null then raise exception 'invalid behaviour batch'; end if;
  if p_profile is not null and not exists(select 1 from profiles where id=p_profile) then raise exception 'profile not found'; end if;
  if (select count(*) from behaviour_events where session_id=p_session and received_at>now()-interval '1 hour')>=240 then raise exception 'behaviour rate limit exceeded'; end if;
  if p_personalisation_allowed then v_pref:=resolve_preference_profile(p_profile,p_anonymous); end if;
  for v_item in select value from jsonb_array_elements(p_events) loop
    if exists(select 1 from jsonb_object_keys(v_item) as item_keys(key) where key<>all(array['event_id','schema_version','event_type','entity_type','entity_id','occurred_at','surface','position','recommendation_request_id','context','metadata'])) then raise exception 'unknown behaviour property'; end if;
    v_event_id:=(v_item->>'event_id')::uuid; v_type:=v_item->>'event_type'; v_entity_type:=nullif(v_item->>'entity_type',''); v_entity_id:=nullif(v_item->>'entity_id','')::uuid; v_context:=coalesce(v_item->'context','{}'); v_metadata:=coalesce(v_item->'metadata','{}'); v_occurred:=(v_item->>'occurred_at')::timestamptz;
    select * into v_catalogue from behaviour_event_catalogue where name=v_type and enabled;
    if not found then raise exception 'unsupported behaviour event'; end if;
    if v_catalogue.high_value and not p_verified then raise exception 'verified event required'; end if;
    if v_occurred<now()-interval '7 days' or v_occurred>now()+interval '5 minutes' then raise exception 'invalid behaviour timestamp'; end if;
    if jsonb_typeof(v_context)<>'object' or jsonb_typeof(v_metadata)<>'object' or pg_column_size(v_context)>8192 or pg_column_size(v_metadata)>8192 or jsonb_has_forbidden_behaviour_key(v_context) or jsonb_has_forbidden_behaviour_key(v_metadata) then raise exception 'invalid behaviour metadata'; end if;
    if (select count(*) from jsonb_object_keys(v_context))>16 or (select count(*) from jsonb_object_keys(v_metadata))>20 then raise exception 'too many behaviour properties'; end if;
    if v_entity_type='event' and not exists(select 1 from events where id=v_entity_id) then raise exception 'event not found'; end if;
    if v_entity_type='venue' and not exists(select 1 from venues where id=v_entity_id) then raise exception 'venue not found'; end if;
    insert into behaviour_events(event_id,schema_version,event_type,profile_id,anonymous_id,session_id,entity_type,entity_id,occurred_at,surface,position,recommendation_request_id,context,metadata,verified,trust_score)
    values(v_event_id,coalesce((v_item->>'schema_version')::smallint,1),v_type,case when p_personalisation_allowed or v_catalogue.privacy_class='essential' then p_profile else null end,p_anonymous,p_session,v_entity_type,v_entity_id,v_occurred,v_item->>'surface',nullif(v_item->>'position','')::integer,nullif(v_item->>'recommendation_request_id','')::uuid,v_context,v_metadata,p_verified,case when p_verified then 1 else 0.5 end)
    on conflict(event_id) do nothing;
    get diagnostics v_inserted=row_count;
    if v_inserted=0 then v_duplicates:=v_duplicates+1; else
      v_accepted:=v_accepted+1;
      if v_pref is not null and v_catalogue.privacy_class in ('personalisation','analytics') then perform apply_behaviour_signal(v_event_id,v_pref); end if;
      if v_type in ('event_opened','venue_opened','event_directions_clicked','venue_directions_clicked','event_booking_clicked','venue_website_clicked','event_shared','venue_shared') then
        insert into analytics_events(action,venue_id,event_id,profile_id,occurred_at,metadata) values(
          case when v_type='event_opened' then 'event_view'::analytics_action when v_type='venue_opened' then 'venue_view'::analytics_action when v_type in ('event_directions_clicked','venue_directions_clicked') then 'directions_click'::analytics_action when v_type in ('event_booking_clicked','venue_website_clicked') then 'booking_click'::analytics_action else 'share'::analytics_action end,
          case when v_entity_type='venue' then v_entity_id when v_entity_type='event' then (select venue_id from events where id=v_entity_id) else null end,
          case when v_entity_type='event' then v_entity_id else null end,case when p_personalisation_allowed then p_profile else null end,v_occurred,jsonb_build_object('surface',v_item->>'surface','schema_version',coalesce((v_item->>'schema_version')::smallint,1)));
      end if;
    end if;
  end loop;
  return jsonb_build_object('accepted',v_accepted,'duplicates',v_duplicates);
end; $$;

create or replace function reset_personalisation_data()
returns void language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=(select auth.uid()); v_pref uuid; v_anonymous uuid;
begin
  if v_profile is null then raise exception 'authentication required'; end if;
  select id,anonymous_id into v_pref,v_anonymous from preference_profiles where profile_id=v_profile for update;
  if v_pref is not null then delete from recommendation_requests where preference_profile_id=v_pref; delete from preference_profiles where id=v_pref; end if;
  delete from behaviour_events where profile_id=v_profile or anonymous_id=v_anonymous;
  update personalisation_settings set personalisation_enabled=false,updated_at=now() where profile_id=v_profile;
end; $$;

create or replace function purge_expired_behaviour_events(
  p_now timestamptz default now(),
  p_limit integer default 10000
) returns integer language plpgsql security definer set search_path=public as $$
declare v_deleted integer;
begin
  if p_limit not between 1 and 50000 then raise exception 'invalid purge limit'; end if;
  with expired as (
    select b.event_id
    from behaviour_events b
    join behaviour_event_catalogue c on c.name=b.event_type
    where b.received_at < p_now-make_interval(days=>c.retention_days)
    order by b.received_at
    limit p_limit
  )
  delete from behaviour_events b using expired e where b.event_id=e.event_id;
  get diagnostics v_deleted=row_count;
  return v_deleted;
end; $$;

create or replace function personalisation_admin_metrics(
  p_since timestamptz default now()-interval '30 days'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not has_platform_role(array['administrator']::app_role[]) then raise exception 'administrator role required'; end if;
  if p_since<now()-interval '366 days' or p_since>now() then raise exception 'invalid metrics period'; end if;
  select jsonb_build_object(
    'since',p_since,
    'behaviour_events',(select count(*) from behaviour_events where received_at>=p_since),
    'anonymous_events',(select count(*) from behaviour_events where received_at>=p_since and profile_id is null),
    'preference_profiles',(select count(*) from preference_profiles),
    'recommendation_requests',(select count(*) from recommendation_requests where created_at>=p_since),
    'average_latency_ms',(select coalesce(round(avg(latency_ms)),0) from recommendation_requests where created_at>=p_since),
    'fallback_requests',(select count(*) from recommendation_requests where created_at>=p_since and fallback_used),
    'impressions',(select count(*) from behaviour_events where received_at>=p_since and event_type='event_impression'),
    'opens',(select count(*) from behaviour_events where received_at>=p_since and event_type in ('event_opened','recommendation_clicked')),
    'skips',(select count(*) from behaviour_events where received_at>=p_since and event_type='event_skipped'),
    'quick_exits',(select count(*) from behaviour_events where received_at>=p_since and event_type='event_quick_exit'),
    'saves',(select count(*) from behaviour_events where received_at>=p_since and event_type='event_saved'),
    'going',(select count(*) from behaviour_events where received_at>=p_since and event_type='event_going'),
    'directions',(select count(*) from behaviour_events where received_at>=p_since and event_type in ('event_directions_clicked','venue_directions_clicked')),
    'verified_check_ins',(select count(*) from behaviour_events where received_at>=p_since and event_type='event_checked_in' and verified),
    'not_interested',(select count(*) from behaviour_events where received_at>=p_since and event_type='event_not_interested'),
    'active_ranking',(select jsonb_build_object('key',key,'version',version,'exploration_ratio',exploration_ratio,'sponsored_minimum_relevance',sponsored_minimum_relevance) from ranking_configs where active order by created_at desc limit 1)
  ) into v_result;
  return v_result;
end; $$;

do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule(
      'purge-expired-behaviour-events',
      '17 3 * * *',
      'select purge_expired_behaviour_events(now(),10000)'
    );
  end if;
end; $$;

insert into feature_flags(key,enabled,label_es,label_en) values
  ('personalised_feed',true,'Feed personalizado','Personalised feed'),('recommendation_reasons',true,'Motivos de recomendación','Recommendation reasons'),('sponsored_recommendations',true,'Recomendaciones patrocinadas','Sponsored recommendations'),('experimental_ranking',false,'Ranking experimental','Experimental ranking'),('social_recommendations',false,'Recomendaciones sociales','Social recommendations'),('partner_api',false,'API para partners','Partner API')
on conflict(key) do nothing;

revoke all on function jsonb_has_forbidden_behaviour_key(jsonb) from public;
revoke all on function upsert_preference_signal(uuid,text,text,numeric,timestamptz) from public;
revoke all on function resolve_preference_profile(uuid,uuid) from public;
revoke all on function apply_behaviour_signal(uuid,uuid) from public;
revoke all on function ingest_behaviour_batch(jsonb,uuid,uuid,uuid,boolean,boolean) from public;
revoke all on function reset_personalisation_data() from public;
revoke all on function purge_expired_behaviour_events(timestamptz,integer) from public;
revoke all on function personalisation_admin_metrics(timestamptz) from public;
grant execute on function ingest_behaviour_batch(jsonb,uuid,uuid,uuid,boolean,boolean) to service_role;
grant execute on function reset_personalisation_data() to authenticated;
grant execute on function purge_expired_behaviour_events(timestamptz,integer) to service_role;
grant execute on function personalisation_admin_metrics(timestamptz) to authenticated;

revoke insert,update,delete on behaviour_event_catalogue,preference_profiles,behaviour_events,user_preference_signals,ranking_configs,recommendation_requests,recommendation_items,experiments,experiment_assignments from anon,authenticated;
grant select on behaviour_event_catalogue,ranking_configs,experiments to anon,authenticated;
grant select on preference_profiles,behaviour_events,user_preference_signals,recommendation_requests,recommendation_items,experiment_assignments to authenticated;

commit;
