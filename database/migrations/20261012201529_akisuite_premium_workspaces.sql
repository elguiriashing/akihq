-- Premium tools remain gated until application, billing and SQL acceptance complete.
begin;
create table akisuite_private.launch_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
insert into akisuite_private.launch_settings(singleton,enabled) values(true,false);
revoke all on akisuite_private.launch_settings from public,anon,authenticated;

create function public.akisuite_launch_ready() returns boolean language sql stable
security definer set search_path='' as $$
  select enabled from akisuite_private.launch_settings where singleton;
$$;
revoke all on function public.akisuite_launch_ready() from public,anon;
grant execute on function public.akisuite_launch_ready() to authenticated,service_role;

create function akisuite_private.venue_workspace(p_venue uuid) returns text
language sql stable set search_path='' as $$
  select v.workspace_id from public.crm_workspace_venues v
    join public.crm_workspaces w on w.id=v.workspace_id
    where v.venue_id=p_venue and w.id<>'ws_akipasa' and w.status in ('active','trial')
      and exists(select 1 from public.venue_members m where m.venue_id=p_venue
        and m.profile_id=w.owner_profile_id and m.role='owner')
    order by (w.source_venue_id=p_venue) desc,w.id limit 1;
$$;
revoke all on function akisuite_private.venue_workspace(uuid) from public,anon,authenticated;

create function akisuite_private.workspace_member(p_workspace text) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from public.crm_workspace_members m join public.crm_workspaces w on w.id=m.workspace_id
    where m.workspace_id=p_workspace and m.profile_id=(select auth.uid()) and m.status='active' and w.status in ('active','trial'));
$$;
revoke all on function akisuite_private.workspace_member(text) from public,anon,authenticated;

create function public.akisuite_venue_premium(p_venue uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_venue_member(p_venue) and (
    exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.app_role='administrator')
    or akisuite_private.plan_active(null,akisuite_private.venue_workspace(p_venue),
      case when (select discovery_vertical from public.venues where id=p_venue)='accommodation'
        then 'akiduermo_premium' else 'akibusiness_premium' end)
    -- Grandfather existing Business subscribers/grants even before a workspace is linked.
    or exists(select 1 from public.venue_members m
      join public.billing_subscriptions s on s.profile_id=m.profile_id
      where m.venue_id=p_venue and m.role='owner' and s.plan_code in ('business','business_pro')
        and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end>now()))
    or exists(select 1 from public.venue_members m
      join public.staff_billing_grants g on g.profile_id=m.profile_id
      where m.venue_id=p_venue and m.role='owner' and g.plan_code in ('business','business_pro')
        and g.active and g.starts_at<=now() and (g.expires_at is null or g.expires_at>now()))
  );
$$;
revoke all on function public.akisuite_venue_premium(uuid) from public,anon;
grant execute on function public.akisuite_venue_premium(uuid) to authenticated;

-- Keep every existing published asset on downgrade; only future uploads consume quota.
create function akisuite_private.guard_media_quota() returns trigger language plpgsql
security definer set search_path='' as $$
declare v_workspace text; v_scope text; v_count bigint; v_bytes bigint; v_limit integer; v_size bigint;
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then return new; end if;
  if not public.is_venue_member(new.venue_id) then raise exception 'venue access required' using errcode='42501'; end if;
  v_workspace:=akisuite_private.venue_workspace(new.venue_id);
  v_scope:=coalesce(v_workspace,new.venue_id::text);
  perform pg_advisory_xact_lock(hashtextextended(v_scope,2));
  select (o.metadata->>'size')::bigint into v_size from storage.objects o
    where o.bucket_id='event-media' and o.name=new.storage_path;
  if v_size is null or v_size<1 or v_size>10485760 or split_part(new.storage_path,'/',1)<>new.venue_id::text
    then raise exception 'invalid stored image'; end if;
  new.size_bytes:=v_size;
  select count(*),coalesce(sum(m.size_bytes),0) into v_count,v_bytes from public.venue_media m
    where case when v_workspace is null then m.venue_id=new.venue_id
      else akisuite_private.venue_workspace(m.venue_id)=v_workspace end;
  v_limit:=case when public.akisuite_venue_premium(new.venue_id) then 250 else 15 end;
  if v_count>=v_limit or v_bytes+v_size>(case when v_limit=250 then 1073741824 else 157286400 end)
    then raise exception 'media allowance exceeded' using errcode='PT402'; end if;
  return new;
end;
$$;
revoke all on function akisuite_private.guard_media_quota() from public,anon,authenticated;
create trigger akisuite_media_quota before insert on public.venue_media
  for each row execute function akisuite_private.guard_media_quota();

alter table public.event_occurrences add column akisuite_recurrence_key timestamp;
create unique index akisuite_recurrence_key_unique on public.event_occurrences(event_id,akisuite_recurrence_key) where akisuite_recurrence_key is not null;

-- Serialize all insert paths so concurrent recurrence/manual occurrence creation cannot duplicate a date.
create function akisuite_private.guard_occurrence_duplicate() returns trigger language plpgsql
security definer set search_path='' as $$
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.event_id::text,3));
  if exists(select 1 from public.event_occurrences o where o.event_id=new.event_id
    and o.starts_at=new.starts_at and o.id<>new.id) then
    raise exception 'duplicate event occurrence' using errcode='23505';
  end if;
  return new;
end;
$$;
revoke all on function akisuite_private.guard_occurrence_duplicate() from public,anon,authenticated;
create trigger akisuite_occurrence_unique before insert or update of event_id,starts_at on public.event_occurrences
  for each row execute function akisuite_private.guard_occurrence_duplicate();

create function public.set_owned_event_recurrence_v2(
  p_event uuid,p_local_starts timestamp,p_local_ends timestamp,p_frequency text,
  p_interval integer,p_occurrences integer,p_timezone text default 'Europe/Madrid',p_exceptions date[] default '{}'
) returns integer language plpgsql security definer set search_path='' as $$
declare v_venue uuid; v_n integer; v_step interval; v_local_start timestamp; v_local_end timestamp;
  v_start timestamptz; v_end timestamptz; v_inserted integer:=0; v_changed integer;
begin
  select venue_id into v_venue from public.events where id=p_event;
  if v_venue is null or not public.akisuite_venue_premium(v_venue)
    then raise exception 'AkiBusiness Premium required' using errcode='PT402'; end if;
  if p_local_starts is null or p_local_ends is null or p_local_ends<=p_local_starts
    or p_frequency is null or p_frequency not in ('daily','weekly') or p_interval is null or p_interval not between 1 and 12
    or p_occurrences is null or p_occurrences not between 2 and 52
    or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone)
    or coalesce(array_length(p_exceptions,1),0)>52 then raise exception 'invalid recurrence'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event::text,3));
  v_step:=make_interval(days=>p_interval*case when p_frequency='weekly' then 7 else 1 end);
  insert into public.recurrence_rules(event_id,rrule,timezone,generation_horizon_days)
    values(p_event,'FREQ='||upper(p_frequency)||';INTERVAL='||p_interval||';COUNT='||p_occurrences,p_timezone,
      least(366,greatest(1,ceil(extract(epoch from(v_step*p_occurrences))/86400)::integer)))
    on conflict(event_id) do update set rrule=excluded.rrule,timezone=excluded.timezone,generation_horizon_days=excluded.generation_horizon_days;
  if extract(epoch from(v_step*(p_occurrences-1)))>366*86400 then raise exception 'recurrence exceeds one year'; end if;
  for v_n in 0..p_occurrences-1 loop
    v_local_start:=p_local_starts+v_n*v_step; v_local_end:=p_local_ends+v_n*v_step;
    if v_local_start::date=any(coalesce(p_exceptions,'{}')) then
      update public.event_occurrences set status='cancelled' where event_id=p_event
        and akisuite_recurrence_key=v_local_start and starts_at>now() and status='scheduled';
      continue;
    end if;
    v_start:=v_local_start at time zone p_timezone; v_end:=v_local_end at time zone p_timezone;
    if (v_start at time zone p_timezone)<>v_local_start or (v_end at time zone p_timezone)<>v_local_end
      then raise exception 'Nonexistent local time: add this date as an exception'; end if;
    if not exists(select 1 from public.event_occurrences where event_id=p_event and starts_at=v_start) then
      insert into public.event_occurrences(id,event_id,starts_at,ends_at,status,akisuite_recurrence_key)
        values(gen_random_uuid(),p_event,v_start,v_end,'scheduled',v_local_start)
        on conflict(event_id,akisuite_recurrence_key) where akisuite_recurrence_key is not null
        do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at
          where public.event_occurrences.status='scheduled' and public.event_occurrences.starts_at>now();
      get diagnostics v_changed=row_count;
      v_inserted:=v_inserted+v_changed;
    end if;
  end loop;
  return v_inserted;
end;
$$;
revoke all on function public.set_owned_event_recurrence_v2(uuid,timestamp,timestamp,text,integer,integer,text,date[]) from public,anon;
grant execute on function public.set_owned_event_recurrence_v2(uuid,timestamp,timestamp,text,integer,integer,text,date[]) to authenticated;

-- Direct API writes are checked as well as server actions; existing occurrences remain editable/cancellable.
create function akisuite_private.guard_event_automation() returns trigger language plpgsql
security definer set search_path='' as $$
declare v_venue uuid;
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then return new; end if;
  select venue_id into v_venue from public.events where id=new.event_id;
  if not public.akisuite_venue_premium(v_venue) then raise exception 'AkiBusiness Premium required' using errcode='PT402'; end if;
  return new;
end;
$$;
revoke all on function akisuite_private.guard_event_automation() from public,anon,authenticated;
create trigger akisuite_recurrence_entitlement before insert or update on public.recurrence_rules
  for each row execute function akisuite_private.guard_event_automation();

create table public.akisuite_event_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  name text not null check(length(btrim(name)) between 2 and 100),
  source_event_id uuid references public.events(id) on delete set null,
  template_document jsonb not null check(jsonb_typeof(template_document)='object' and length(template_document::text)<=100000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(workspace_id,name)
);
alter table public.akisuite_event_templates enable row level security;
revoke all on public.akisuite_event_templates from public,anon,authenticated;
grant select on public.akisuite_event_templates to authenticated;
grant all on public.akisuite_event_templates to service_role;
create policy akisuite_event_templates_read on public.akisuite_event_templates for select to authenticated
  using(exists(select 1 from public.crm_workspace_members m where m.workspace_id=akisuite_event_templates.workspace_id
    and m.profile_id=(select auth.uid()) and m.status='active'));

create function public.save_akisuite_event_template(p_event uuid,p_name text) returns uuid language plpgsql
security definer set search_path='' as $$
declare v_venue uuid; v_workspace text; v_id uuid;
begin
  select venue_id into v_venue from public.events where id=p_event;
  if not public.akisuite_venue_premium(v_venue) then raise exception 'AkiBusiness Premium required' using errcode='PT402'; end if;
  v_workspace:=akisuite_private.venue_workspace(v_venue);
  if v_workspace is null or not akisuite_private.workspace_member(v_workspace) then raise exception 'workspace membership required' using errcode='42501'; end if;
  insert into public.akisuite_event_templates(workspace_id,name,source_event_id,created_by,template_document)
    select v_workspace,btrim(p_name),p_event,(select auth.uid()),jsonb_build_object(
      'title_es',e.title_es,'title_en',e.title_en,'description_es',e.description_es,'description_en',e.description_en,
      'category_id',e.category_id,'price_cents',e.price_cents,'currency',e.currency,'booking_url',e.booking_url
    ) from public.events e where e.id=p_event
    on conflict(workspace_id,name) do update set source_event_id=excluded.source_event_id,template_document=excluded.template_document
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.save_akisuite_event_template(uuid,text) from public,anon;
grant execute on function public.save_akisuite_event_template(uuid,text) to authenticated;

create function public.duplicate_akisuite_event(p_event uuid,p_slug text) returns uuid language plpgsql
security definer set search_path='' as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.events where id=p_event;
  if not public.akisuite_venue_premium(v_venue) then raise exception 'AkiBusiness Premium required' using errcode='PT402'; end if;
  return public.duplicate_owned_event(p_event,p_slug);
end;
$$;
revoke all on function public.duplicate_akisuite_event(uuid,text) from public,anon;
grant execute on function public.duplicate_akisuite_event(uuid,text) to authenticated;

create function public.create_akisuite_event_from_template(p_template uuid,p_venue uuid,p_slug text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_document jsonb; v_id uuid:=gen_random_uuid();
begin
  if not public.akisuite_venue_premium(p_venue) then raise exception 'AkiBusiness Premium required' using errcode='PT402'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)>150 then raise exception 'invalid slug'; end if;
  select template_document into v_document from public.akisuite_event_templates t
    where t.id=p_template and t.workspace_id=akisuite_private.venue_workspace(p_venue) and akisuite_private.workspace_member(t.workspace_id);
  if v_document is null then raise exception 'template access required' using errcode='42501'; end if;
  insert into public.events(id,venue_id,slug,title_es,title_en,description_es,description_en,category_id,price_cents,currency,source,sponsored,booking_url,status)
    values(v_id,p_venue,p_slug,v_document->>'title_es',v_document->>'title_en',v_document->>'description_es',v_document->>'description_en',
      (v_document->>'category_id')::uuid,(v_document->>'price_cents')::integer,v_document->>'currency','verified_venue',false,v_document->>'booking_url','draft');
  return v_id;
end;
$$;
revoke all on function public.create_akisuite_event_from_template(uuid,uuid,text) from public,anon;
grant execute on function public.create_akisuite_event_from_template(uuid,uuid,text) to authenticated;

create function public.cancel_akisuite_future_dates(p_event uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare v_venue uuid; v_count integer;
begin
  select venue_id into v_venue from public.events where id=p_event;
  if v_venue is null or not public.is_venue_member(v_venue) then raise exception 'venue access required' using errcode='42501'; end if;
  update public.event_occurrences set status='cancelled' where event_id=p_event and starts_at>now() and status='scheduled';
  get diagnostics v_count=row_count;
  delete from public.recurrence_rules where event_id=p_event;
  return v_count;
end;
$$;
revoke all on function public.cancel_akisuite_future_dates(uuid) from public,anon;
grant execute on function public.cancel_akisuite_future_dates(uuid) to authenticated;

-- Production preflight found no duplicate (event_id, starts_at) pairs.
-- This unique index also prevents concurrent individual-date inserts from racing.
create unique index akisuite_occurrence_instant_unique on public.event_occurrences(event_id,starts_at);

-- Read-only comparisons. Counts are AkiPasa interactions, never fabricated Google ranking metrics.
create function public.akisuite_growth_report(p_venue uuid,p_days integer default 28) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_now timestamptz:=now(); v_current bigint; v_previous bigint; v_events bigint; v_media bigint; v_breakdown jsonb; v_event_stats jsonb;
begin
  if not public.akisuite_venue_premium(p_venue) then raise exception 'Premium required' using errcode='PT402'; end if;
  if p_days is null or p_days not between 7 and 90 then raise exception 'invalid reporting period'; end if;
  select count(*) filter(where a.occurred_at>=v_now-make_interval(days=>p_days)),
    count(*) filter(where a.occurred_at<v_now-make_interval(days=>p_days))
    into v_current,v_previous from public.analytics_events a
    where a.venue_id=p_venue and a.occurred_at>=v_now-make_interval(days=>p_days*2) and a.occurred_at<=v_now;
  select coalesce(jsonb_agg(to_jsonb(stats)),'[]'::jsonb) into v_breakdown from (
    select a.action::text as action,
      count(*) filter(where a.occurred_at>=v_now-make_interval(days=>p_days)) as current,
      count(*) filter(where a.occurred_at<v_now-make_interval(days=>p_days)) as previous
    from public.analytics_events a where a.venue_id=p_venue
      and a.occurred_at between v_now-make_interval(days=>p_days*2) and v_now group by a.action
  ) stats;
  select coalesce(jsonb_agg(to_jsonb(stats)),'[]'::jsonb) into v_event_stats from (
    select e.id,e.title_es,e.title_en,
      count(a.event_id) filter(where a.occurred_at>=v_now-make_interval(days=>p_days)) as current,
      count(a.event_id) filter(where a.occurred_at<v_now-make_interval(days=>p_days)) as previous
    from public.events e left join public.analytics_events a on a.event_id=e.id
      and a.occurred_at between v_now-make_interval(days=>p_days*2) and v_now
    where e.venue_id=p_venue group by e.id order by e.id limit 100
  ) stats;
  select count(*) into v_events from public.events e where e.venue_id=p_venue and e.status='published';
  select count(*) into v_media from public.venue_media m where m.venue_id=p_venue;
  return jsonb_build_object('days',p_days,'current',v_current,'previous',v_previous,
    'publishedEvents',v_events,'images',v_media,'actions',v_breakdown,'events',v_event_stats,'source','akipasa_interactions');
end;
$$;
revoke all on function public.akisuite_growth_report(uuid,integer) from public,anon;
grant execute on function public.akisuite_growth_report(uuid,integer) to authenticated;
-- Team members may inspect effective workspace access without seeing the payer's invoices.
create function public.akisuite_accessible_workspace_plans() returns table(id text,name text,plans text[])
language sql stable security definer set search_path='' as $$
  select w.id,w.name,array(select plan from unnest(array['akibusiness_premium','akiduermo_premium','akihq_standard','akihq_pro','akihq_business_addon','aki_enterprise']) plan
    where akisuite_private.plan_active(null,w.id,plan))
  from public.crm_workspaces w join public.crm_workspace_members m on m.workspace_id=w.id
  where w.status in ('active','trial') and m.status='active' and m.profile_id=(select auth.uid()) and w.id<>'ws_akipasa'
  order by w.name,w.id;
$$;
revoke all on function public.akisuite_accessible_workspace_plans() from public,anon;
grant execute on function public.akisuite_accessible_workspace_plans() to authenticated;

create function public.akisuite_owned_workspaces() returns table(id text,name text)
language sql stable security definer set search_path='' as $$
  select w.id,w.name from public.crm_workspaces w where w.owner_profile_id=(select auth.uid())
    and w.status in ('active','trial') order by w.name,w.id;
$$;
revoke all on function public.akisuite_owned_workspaces() from public,anon;
grant execute on function public.akisuite_owned_workspaces() to authenticated;

create function public.prepare_akisuite_workspace(p_name text default null) returns text language plpgsql
security definer set search_path='' as $$
declare v_profile uuid:=(select auth.uid()); v_venue uuid; v_name text; v_workspace text;
begin
  if v_profile is null then raise exception 'sign in required' using errcode='42501'; end if;
  select v.id,v.name into v_venue,v_name from public.venue_members m join public.venues v on v.id=m.venue_id
    where m.profile_id=v_profile and m.role='owner' order by v.id limit 1;
  if p_name is not null and length(btrim(p_name)) not between 2 and 120 then raise exception 'invalid workspace name'; end if;
  v_name:=coalesce(nullif(btrim(p_name),''),v_name);
  if v_name is null then raise exception 'workspace name required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_profile::text,0));
  select w.id into v_workspace from public.crm_workspaces w where w.owner_profile_id=v_profile
    and w.id<>'ws_akipasa' and w.status in ('active','trial') order by w.id limit 1;
  if v_workspace is null then
    v_workspace:='ws_suite_'||v_profile::text;
    insert into public.crm_workspaces(id,name,slug,owner_profile_id,source_venue_id,plan,status,seat_limit)
      values(v_workspace,v_name,'akisuite-'||v_profile::text,v_profile,v_venue,'growth','active',4);
    insert into public.crm_workspace_members(workspace_id,profile_id,role,status)
      values(v_workspace,v_profile,'owner','active');
  end if;
  insert into public.crm_workspace_venues(workspace_id,venue_id)
    select v_workspace,m.venue_id from public.venue_members m where m.profile_id=v_profile and m.role='owner'
      and not exists(select 1 from public.crm_workspace_venues l where l.venue_id=m.venue_id and l.workspace_id<>'ws_akipasa')
    on conflict do nothing;
  return v_workspace;
end;
$$;
revoke all on function public.prepare_akisuite_workspace(text) from public,anon;
grant execute on function public.prepare_akisuite_workspace(text) to authenticated;

create or replace function public.crm_can_access_workspace(p_workspace text) returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and (
    exists(select 1 from public.crm_workspace_members m join public.crm_workspaces w on w.id=m.workspace_id
      where m.workspace_id=p_workspace and m.profile_id=(select auth.uid()) and m.status='active'
        and w.status in ('active','trial') and (w.id='ws_akipasa' or public.has_active_entitlement(w.owner_profile_id,'business')
          or akisuite_private.plan_active(null,p_workspace,'akihq_standard')))
    or exists(select 1 from public.profiles where id=(select auth.uid()) and app_role='administrator')
  );
$$;

create function akisuite_private.workspace_tool_entitlement(p_workspace text,p_tool text) returns boolean
language sql stable set search_path='' as $$
  select
    exists(select 1 from public.crm_workspace_entitlements e join public.crm_tool_catalog c on c.tool_key=e.tool_key
      where e.workspace_id=p_workspace and e.tool_key=p_tool and e.active and c.active
        and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
        and (e.source in ('manual','platform','purchase','trial')
          or not exists(select 1 from public.akisuite_billing_subscriptions s where s.workspace_id=p_workspace
            and s.plan_code in ('akihq_standard','akihq_pro','aki_enterprise'))
          or public.has_active_entitlement((select owner_profile_id from public.crm_workspaces where id=p_workspace),'business_pro')))
    or (exists(select 1 from public.crm_tool_catalog c where c.tool_key=p_tool and c.active)
      and (
        (p_tool in ('dashboard','crm','tasks','calendar','employees','integrations')
          and akisuite_private.plan_active(null,p_workspace,'akihq_standard'))
        or (p_tool in ('dashboard','crm','crm-social','inbox','tasks','calendar','inventory','pos','sales','automation','collaboration','employees','knowledge','integrations')
          and akisuite_private.plan_active(null,p_workspace,'akihq_pro'))
      ));
$$;
revoke all on function akisuite_private.workspace_tool_entitlement(text,text) from public,anon,authenticated;

create or replace function public.crm_has_tool(p_workspace text,p_tool text) returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and public.crm_can_access_workspace(p_workspace)
    and exists(select 1 from public.crm_workspaces w where w.id=p_workspace and w.status in ('active','trial'))
    and akisuite_private.workspace_tool_entitlement(p_workspace,p_tool)
    and (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.app_role='administrator')
      or exists(select 1 from public.crm_workspace_members m where m.workspace_id=p_workspace
        and m.profile_id=(select auth.uid()) and m.status='active' and (
          m.role='owner' or (m.role='admin' and m.role_template_id is null)
          or exists(select 1 from public.crm_role_templates t join public.crm_role_template_tools tt on tt.template_id=t.id
            where t.id=m.role_template_id and t.workspace_id=p_workspace and tt.tool_key=p_tool))));
$$;

create table public.akisuite_media_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  name text not null check(length(btrim(name)) between 1 and 80),
  unique(workspace_id,name)
);
alter table public.akisuite_media_folders enable row level security;
revoke all on public.akisuite_media_folders from public,anon,authenticated;
grant select on public.akisuite_media_folders to authenticated;
grant all on public.akisuite_media_folders to service_role;
create policy akisuite_media_folders_read on public.akisuite_media_folders for select to authenticated
  using(exists(select 1 from public.crm_workspace_members m where m.workspace_id=akisuite_media_folders.workspace_id
    and m.profile_id=(select auth.uid()) and m.status='active'));
alter table public.venue_media add column akisuite_folder_id uuid references public.akisuite_media_folders(id) on delete set null;

create function public.akisuite_media_allowed(p_venue uuid,p_media uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_venue_member(p_venue) and exists(select 1 from public.venue_media m where m.id=p_media
    and (m.venue_id=p_venue or (
      akisuite_private.venue_workspace(p_venue) is not null
      and akisuite_private.venue_workspace(p_venue)=akisuite_private.venue_workspace(m.venue_id)
      and ((public.akisuite_venue_premium(p_venue) and akisuite_private.workspace_member(akisuite_private.venue_workspace(p_venue))) or exists(select 1 from public.venue_media_placements keep
        where keep.venue_id=p_venue and keep.media_id=m.id)))));
$$;
revoke all on function public.akisuite_media_allowed(uuid,uuid) from public,anon;
grant execute on function public.akisuite_media_allowed(uuid,uuid) to authenticated;

create function public.akisuite_media_library(p_venue uuid)
returns table(id uuid,venue_id uuid,storage_path text,alt_es text,alt_en text,mime_type text,size_bytes integer,sort_order integer,folder_id uuid,folder_name text)
language plpgsql stable security definer set search_path='' as $$
declare v_workspace text;
begin
  if not public.is_venue_member(p_venue) then raise exception 'venue access required' using errcode='42501'; end if;
  v_workspace:=akisuite_private.venue_workspace(p_venue);
  return query select m.id,m.venue_id,m.storage_path,m.alt_es,m.alt_en,m.mime_type,m.size_bytes,m.sort_order,f.id,f.name
    from public.venue_media m left join public.akisuite_media_folders f on f.id=m.akisuite_folder_id
    where m.venue_id=p_venue or (v_workspace is not null and akisuite_private.workspace_member(v_workspace) and akisuite_private.venue_workspace(m.venue_id)=v_workspace)
      or exists(select 1 from public.venue_media_placements retained where retained.venue_id=p_venue and retained.media_id=m.id)
    order by m.sort_order,m.id limit 1000;
end;
$$;
revoke all on function public.akisuite_media_library(uuid) from public,anon;
grant execute on function public.akisuite_media_library(uuid) to authenticated;

-- Check all referencing venues under the asset owner's authority, including rows hidden by RLS.
create function public.akisuite_media_in_use(p_media uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.venue_media where id=p_media;
  if v_venue is null or not public.is_venue_member(v_venue) then raise exception 'media owner required' using errcode='42501'; end if;
  return exists(select 1 from public.venue_media_placements p where p.media_id=p_media);
end;
$$;
revoke all on function public.akisuite_media_in_use(uuid) from public,anon;
grant execute on function public.akisuite_media_in_use(uuid) to authenticated;

create function public.set_akisuite_media_folder(p_media uuid,p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_venue uuid; v_workspace text; v_folder uuid;
begin
  select venue_id into v_venue from public.venue_media where id=p_media;
  if not public.akisuite_venue_premium(v_venue) then raise exception 'Premium required' using errcode='PT402'; end if;
  v_workspace:=akisuite_private.venue_workspace(v_venue);
  if v_workspace is null or not akisuite_private.workspace_member(v_workspace) then raise exception 'workspace membership required' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name))=0 then
    update public.venue_media set akisuite_folder_id=null where id=p_media; return null;
  end if;
  insert into public.akisuite_media_folders(workspace_id,name) values(v_workspace,btrim(p_name))
    on conflict(workspace_id,name) do update set name=excluded.name returning id into v_folder;
  update public.venue_media set akisuite_folder_id=v_folder where id=p_media;
  return v_folder;
end;
$$;
revoke all on function public.set_akisuite_media_folder(uuid,text) from public,anon;
grant execute on function public.set_akisuite_media_folder(uuid,text) to authenticated;

create function akisuite_private.guard_media_placement() returns trigger language plpgsql
security definer set search_path='' as $$
begin
  if (select enabled from akisuite_private.launch_settings where singleton) then
    perform pg_advisory_xact_lock(hashtextextended(new.media_id::text,4));
    if not exists(select 1 from public.venue_media m join storage.objects o on o.bucket_id='event-media' and o.name=m.storage_path where m.id=new.media_id)
      then raise exception 'stored media unavailable'; end if;
  end if;
  if (select enabled from akisuite_private.launch_settings where singleton)
    and not public.akisuite_media_allowed(new.venue_id,new.media_id)
    then raise exception 'media access required' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function akisuite_private.guard_media_placement() from public,anon,authenticated;
create trigger akisuite_media_placement_access before insert or update of venue_id,media_id on public.venue_media_placements
  for each row execute function akisuite_private.guard_media_placement();

-- Scheduled publication retains moderation: only already-approved content can be scheduled.
create table public.akisuite_event_publication_schedules (
  event_id uuid primary key references public.events(id) on delete cascade,
  publish_at timestamptz not null,
  approved_fingerprint text not null,
  state text not null default 'scheduled' check(state in ('scheduled','published','blocked','cancelled')),
  blocked_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.akisuite_event_publication_schedules enable row level security;
revoke all on public.akisuite_event_publication_schedules from public,anon,authenticated;
grant select on public.akisuite_event_publication_schedules to authenticated;
grant all on public.akisuite_event_publication_schedules to service_role;
create policy akisuite_event_schedules_read on public.akisuite_event_publication_schedules for select to authenticated
  using(exists(select 1 from public.events e where e.id=event_id and public.is_venue_member(e.venue_id)));

create function public.schedule_akisuite_event(p_event uuid,p_publish_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare v_event public.events%rowtype;
begin
  select * into v_event from public.events where id=p_event for update;
  if v_event.id is null or not public.akisuite_venue_premium(v_event.venue_id)
    then raise exception 'AkiBusiness Premium required' using errcode='PT402'; end if;
  if v_event.status<>'published' and not (v_event.status='draft' and exists(select 1 from public.venues trusted where trusted.id=v_event.venue_id and trusted.verified)) then raise exception 'approved event required'; end if;
  if p_publish_at is null or p_publish_at<=now() or p_publish_at>now()+interval '366 days' then raise exception 'invalid publication time'; end if;
  insert into public.akisuite_event_publication_schedules(event_id,publish_at,approved_fingerprint,created_by)
    values(p_event,p_publish_at,encode(sha256(convert_to((to_jsonb(v_event)-'status'-'updated_at')::text,'UTF8')),'hex'),(select auth.uid()))
    on conflict(event_id) do update set publish_at=excluded.publish_at,approved_fingerprint=excluded.approved_fingerprint,state='scheduled',blocked_reason=null;
  update public.events set status='draft' where id=p_event;
end;
$$;
revoke all on function public.schedule_akisuite_event(uuid,timestamptz) from public,anon;
grant execute on function public.schedule_akisuite_event(uuid,timestamptz) to authenticated;

create function public.cancel_akisuite_publication(p_event uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.events e where e.id=p_event and public.is_venue_member(e.venue_id))
    then raise exception 'venue access required' using errcode='42501'; end if;
  update public.akisuite_event_publication_schedules set state='cancelled' where event_id=p_event and state='scheduled';
  -- Keep the draft: cancellation must never publish content without moderation.
end;
$$;
revoke all on function public.cancel_akisuite_publication(uuid) from public,anon;
grant execute on function public.cancel_akisuite_publication(uuid) to authenticated;

create function public.publish_due_akisuite_events(p_limit integer default 25) returns integer
language plpgsql security definer set search_path='' as $$
declare v_schedule record; v_event public.events%rowtype; v_workspace text; v_count integer:=0; v_paid boolean;
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then return 0; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid batch size'; end if;
  for v_schedule in select * from public.akisuite_event_publication_schedules s where s.state='scheduled' and s.publish_at<=now()
    order by s.publish_at for update skip locked limit p_limit loop
    select * into v_event from public.events where id=v_schedule.event_id for update;
    v_workspace:=akisuite_private.venue_workspace(v_event.venue_id);
    v_paid:=akisuite_private.plan_active(null,v_workspace,'akibusiness_premium') or exists(
      select 1 from public.venue_members m where m.venue_id=v_event.venue_id and m.role='owner'
        and (exists(select 1 from public.billing_subscriptions legacy where legacy.profile_id=m.profile_id
          and legacy.plan_code in ('business','business_pro') and legacy.status in ('active','trialing')
          and (legacy.current_period_end is null or legacy.current_period_end>now()))
        or exists(select 1 from public.staff_billing_grants g where g.profile_id=m.profile_id
          and g.plan_code in ('business','business_pro') and g.active and g.starts_at<=now() and (g.expires_at is null or g.expires_at>now()))));
    if not v_paid or v_event.status<>'draft' or encode(sha256(convert_to((to_jsonb(v_event)-'status'-'updated_at')::text,'UTF8')),'hex')<>v_schedule.approved_fingerprint then
      update public.akisuite_event_publication_schedules set state='blocked',blocked_reason=case when not v_paid then 'entitlement' else 'content_changed' end where event_id=v_schedule.event_id;
      continue;
    end if;
    update public.events set status='published' where id=v_schedule.event_id;
    update public.akisuite_event_publication_schedules set state='published' where event_id=v_schedule.event_id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.publish_due_akisuite_events(integer) from public,anon,authenticated;
grant execute on function public.publish_due_akisuite_events(integer) to service_role;

create function public.akisuite_stay_report(p_venue uuid,p_days integer default 28) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_today date:=(now() at time zone 'Europe/Madrid')::date; v_nights bigint; v_previous bigint; v_requests bigint; v_quote bigint;
begin
  if (select discovery_vertical from public.venues where id=p_venue)<>'accommodation'
    or not public.akisuite_venue_premium(p_venue) then raise exception 'AkiDuermo Premium required' using errcode='PT402'; end if;
  if p_days is null or p_days not between 7 and 90 then raise exception 'invalid reporting period'; end if;
  select coalesce(sum(greatest(0,least(r.check_out,v_today+1)-greatest(r.check_in,v_today+1-p_days))),0),
    coalesce(sum(greatest(0,least(r.check_out,v_today+1-p_days)-greatest(r.check_in,v_today+1-2*p_days))),0)
    into v_nights,v_previous from public.accommodation_reservations r
    where r.venue_id=p_venue and r.status in ('confirmed','checked_in','completed')
      and r.check_out>v_today+1-2*p_days and r.check_in<v_today+1;
  select count(*),coalesce(sum(quoted_total_cents),0) into v_requests,v_quote
    from public.accommodation_reservations r where r.venue_id=p_venue and r.created_at>=now()-make_interval(days=>p_days);
  return jsonb_build_object('days',p_days,'confirmedNights',v_nights,'previousConfirmedNights',v_previous,
    'receivedRequests',v_requests,'quotedValueCents',v_quote,'source','reservation_records');
end;
$$;
revoke all on function public.akisuite_stay_report(uuid,integer) from public,anon;
grant execute on function public.akisuite_stay_report(uuid,integer) to authenticated;

-- Preserve the old RPC contract while closing direct-call bypasses of Premium automation.
alter function public.duplicate_owned_event(uuid,text) set schema akisuite_private;
alter function akisuite_private.duplicate_owned_event(uuid,text) rename to duplicate_event_legacy;
revoke all on function akisuite_private.duplicate_event_legacy(uuid,text) from public,anon,authenticated;
create function public.duplicate_owned_event(p_event uuid,p_slug text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.events where id=p_event;
  if (select enabled from akisuite_private.launch_settings where singleton)
    and not public.akisuite_venue_premium(v_venue) then raise exception 'AkiBusiness Premium required' using errcode='PT402'; end if;
  return akisuite_private.duplicate_event_legacy(p_event,p_slug);
end;
$$;
revoke all on function public.duplicate_owned_event(uuid,text) from public,anon;
grant execute on function public.duplicate_owned_event(uuid,text) to authenticated;

alter function public.set_owned_event_recurrence(uuid,timestamptz,timestamptz,text,integer,integer) set schema akisuite_private;
alter function akisuite_private.set_owned_event_recurrence(uuid,timestamptz,timestamptz,text,integer,integer) rename to set_recurrence_legacy;
revoke all on function akisuite_private.set_recurrence_legacy(uuid,timestamptz,timestamptz,text,integer,integer) from public,anon,authenticated;
create function public.set_owned_event_recurrence(p_event uuid,p_starts timestamptz,p_ends timestamptz,p_frequency text,p_interval integer,p_occurrences integer) returns integer
language plpgsql security definer set search_path='' as $$
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then
    return akisuite_private.set_recurrence_legacy(p_event,p_starts,p_ends,p_frequency,p_interval,p_occurrences);
  end if;
  return public.set_owned_event_recurrence_v2(p_event,p_starts at time zone 'Europe/Madrid',p_ends at time zone 'Europe/Madrid',p_frequency,p_interval,p_occurrences,'Europe/Madrid','{}');
end;
$$;
revoke all on function public.set_owned_event_recurrence(uuid,timestamptz,timestamptz,text,integer,integer) from public,anon;
grant execute on function public.set_owned_event_recurrence(uuid,timestamptz,timestamptz,text,integer,integer) to authenticated;

revoke all on function public.crm_has_tool(text,text),public.crm_can_access_workspace(text) from public,anon;
grant execute on function public.crm_has_tool(text,text),public.crm_can_access_workspace(text) to authenticated,service_role;
notify pgrst,'reload schema';


create function public.akisuite_can_read_shared_media(p_path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_source uuid; v_workspace text;
begin
  if (select auth.uid()) is null or split_part(p_path,'/',1) !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  v_source:=split_part(p_path,'/',1)::uuid;
  v_workspace:=akisuite_private.venue_workspace(v_source);
  return v_workspace is not null and exists(select 1 from public.crm_workspace_venues v
    where v.workspace_id=v_workspace and public.is_venue_member(v.venue_id));
end;
$$;
revoke all on function public.akisuite_can_read_shared_media(text) from public,anon;
grant execute on function public.akisuite_can_read_shared_media(text) to authenticated;


create function public.akisuite_templates_for_venue(p_venue uuid) returns table(id uuid,name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_venue_member(p_venue) then raise exception 'venue access required' using errcode='42501'; end if;
  return query select t.id,t.name from public.akisuite_event_templates t
    where t.workspace_id=akisuite_private.venue_workspace(p_venue) and akisuite_private.workspace_member(t.workspace_id) order by t.name;
end;
$$;
revoke all on function public.akisuite_templates_for_venue(uuid) from public,anon;
grant execute on function public.akisuite_templates_for_venue(uuid) to authenticated;
-- Never renew a discounted add-on when its qualifying Pro plan is ending or unavailable.
create function public.akisuite_addons_requiring_cancellation() returns table(subscription_id text,customer_id text)
language sql stable security definer set search_path='' as $$
  select a.stripe_subscription_id,a.stripe_customer_id from public.akisuite_billing_subscriptions a
  where a.plan_code='akihq_business_addon' and a.status not in ('canceled','incomplete_expired') and not a.cancel_at_period_end
    and (not akisuite_private.paid_pro(a.workspace_id,false) or exists(
      select 1 from public.akisuite_billing_subscriptions p where p.workspace_id=a.workspace_id
        and p.plan_code='akihq_pro' and p.status in ('active','trialing') and p.cancel_at_period_end))
  order by a.stripe_subscription_id limit 25;
$$;
revoke all on function public.akisuite_addons_requiring_cancellation() from public,anon,authenticated;
grant execute on function public.akisuite_addons_requiring_cancellation() to service_role;

-- Direct client UPDATE cannot forge storage accounting or assign a folder from another tenant.
create function akisuite_private.guard_media_update() returns trigger language plpgsql
security definer set search_path='' as $$
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then return new; end if;
  if new.venue_id is distinct from old.venue_id or new.storage_path is distinct from old.storage_path
    then raise exception 'stored media identity is immutable' using errcode='42501'; end if;
  new.size_bytes:=old.size_bytes;
  if new.akisuite_folder_id is distinct from old.akisuite_folder_id and new.akisuite_folder_id is not null then
    if not public.akisuite_venue_premium(old.venue_id) or not akisuite_private.workspace_member(akisuite_private.venue_workspace(old.venue_id)) or not exists(select 1 from public.akisuite_media_folders f
      where f.id=new.akisuite_folder_id and f.workspace_id=akisuite_private.venue_workspace(old.venue_id))
      then raise exception 'authorised Premium folder required' using errcode='42501'; end if;
  end if;
  return new;
end;
$$;
revoke all on function akisuite_private.guard_media_update() from public,anon,authenticated;
create trigger akisuite_media_update before update on public.venue_media
  for each row execute function akisuite_private.guard_media_update();
-- Restrictive policies complement existing Storage policies; they never grant new write access.
create function public.akisuite_storage_upload_allowed(p_name text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_venue uuid; v_workspace text; v_limit integer; v_count bigint; v_bytes bigint;
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then return true; end if;
  if p_name is null or length(p_name)>1000 or split_part(p_name,'/',1)!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_venue:=split_part(p_name,'/',1)::uuid;
  if not public.is_venue_member(v_venue) then return false; end if;
  v_workspace:=akisuite_private.venue_workspace(v_venue);
  perform pg_advisory_xact_lock(hashtextextended(coalesce(v_workspace,v_venue::text),2));
  v_limit:=case when public.akisuite_venue_premium(v_venue) then 250 else 15 end;
  select count(*),coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 10485760 end),0)
    into v_count,v_bytes from storage.objects o
    where o.bucket_id='event-media' and o.name<>p_name and (
      split_part(o.name,'/',1)=v_venue::text or (v_workspace is not null and exists(
        select 1 from public.crm_workspace_venues linked where linked.workspace_id=v_workspace and linked.venue_id::text=split_part(o.name,'/',1))));
  -- The existing bucket caps objects at 10 MiB. Reserve that upper bound before accepting bytes.
  return v_count<v_limit and v_bytes+10485760<=case when v_limit=250 then 1073741824 else 157286400 end;
end;
$$;
revoke all on function public.akisuite_storage_upload_allowed(text) from public,anon;
grant execute on function public.akisuite_storage_upload_allowed(text) to authenticated;
create policy akisuite_storage_upload_quota on storage.objects as restrictive for insert to authenticated
  with check(bucket_id<>'event-media' or public.akisuite_storage_upload_allowed(name));
create policy akisuite_storage_update_quota on storage.objects as restrictive for update to authenticated
  using(bucket_id<>'event-media' or public.akisuite_storage_upload_allowed(name))
  with check(bucket_id<>'event-media' or public.akisuite_storage_upload_allowed(name));

create function public.akisuite_storage_delete_allowed(p_name text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_media uuid;
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then return true; end if;
  select id into v_media from public.venue_media where storage_path=p_name;
  if v_media is null then return true; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_media::text,4));
  return not exists(select 1 from public.venue_media_placements where media_id=v_media);
end;
$$;
revoke all on function public.akisuite_storage_delete_allowed(text) from public,anon;
grant execute on function public.akisuite_storage_delete_allowed(text) to authenticated;
create policy akisuite_storage_reference_delete on storage.objects as restrictive for delete to authenticated
  using(bucket_id<>'event-media' or public.akisuite_storage_delete_allowed(name));

-- Public reads expose selected artwork and the existing own-venue fallback, never the entire private bin.
create function public.akisuite_storage_owner(p_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
  if p_name is null or length(p_name)>1000 or split_part(p_name,'/',1)!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.is_venue_member(split_part(p_name,'/',1)::uuid);
end;
$$;
revoke all on function public.akisuite_storage_owner(text) from public,anon;
grant execute on function public.akisuite_storage_owner(text) to authenticated;
create function public.akisuite_storage_read_allowed(p_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_media public.venue_media%rowtype; v_workspace text;
begin
  if not (select enabled from akisuite_private.launch_settings where singleton) then return true; end if;
  if public.akisuite_storage_owner(p_name) then return true; end if;
  select * into v_media from public.venue_media where storage_path=p_name;
  if v_media.id is null then return false; end if;
  v_workspace:=akisuite_private.venue_workspace(v_media.venue_id);
  if v_workspace is not null and akisuite_private.workspace_member(v_workspace) and exists(select 1 from public.venue_members member
    where member.profile_id=(select auth.uid()) and member.role in ('editor','manager','owner')
      and akisuite_private.venue_workspace(member.venue_id)=v_workspace) then return true; end if;
  if exists(select 1 from public.venues v where v.id=v_media.venue_id and v.status='published'
    and v_media.id=(select fallback.id from public.venue_media fallback where fallback.venue_id=v.id order by fallback.sort_order,fallback.id limit 1)) then return true; end if;
  if exists(select 1 from public.venue_media_placements retained where retained.media_id=v_media.id and public.is_venue_member(retained.venue_id)) then return true; end if;
  return exists(select 1 from public.venue_media_placements place join public.venues visible on visible.id=place.venue_id
    where place.media_id=v_media.id and visible.status='published' and (
      (place.placement in ('venue_profile','venue_cover','venue_menu','venue_events','venue_explore') and place.target_key='')
      or (place.placement='venue_gallery' and place.target_key='stay_header')
      or (place.placement in ('event_banner','event_explore','event_profile','event_background','event_map_vertical')
        and exists(select 1 from public.events e where e.id::text=place.target_key and e.venue_id=place.venue_id and e.status='published'))));
end;
$$;
revoke all on function public.akisuite_storage_read_allowed(text) from public;
grant execute on function public.akisuite_storage_read_allowed(text) to anon,authenticated;
create policy akisuite_storage_owner_read on storage.objects for select to authenticated
  using(bucket_id='event-media' and public.akisuite_storage_owner(name));
create policy akisuite_storage_workspace_read on storage.objects for select to authenticated
  using(bucket_id='event-media' and public.akisuite_launch_ready() and public.akisuite_storage_read_allowed(name));
create policy akisuite_storage_private_bin on storage.objects as restrictive for select to anon,authenticated
  using(bucket_id<>'event-media' or public.akisuite_storage_read_allowed(name));
create policy akisuite_media_private_bin on public.venue_media as restrictive for select to anon,authenticated
  using(public.akisuite_storage_read_allowed(storage_path));
commit;
