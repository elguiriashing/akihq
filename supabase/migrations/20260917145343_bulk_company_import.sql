begin;

-- Imported companies live outside workspace snapshots and browser localStorage.
create table public.crm_company_records (
  seq bigint generated always as identity unique,
  workspace_id text not null references public.crm_workspaces(id),
  id text not null,
  data jsonb not null check(jsonb_typeof(data)='object'),
  identity_key text not null,
  import_id uuid,
  revision integer not null default 1,
  deleted_at timestamptz,
  publish_state text not null default 'pending' check(publish_state in ('pending','working','published','skipped')),
  publish_token uuid,
  publish_lease timestamptz,
  publish_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,id)
);
create index crm_company_identity_idx on public.crm_company_records(workspace_id,identity_key) where deleted_at is null;
create index crm_company_page_idx on public.crm_company_records(workspace_id,seq) where deleted_at is null;
create index crm_company_import_idx on public.crm_company_records(import_id,seq);
create index crm_company_publish_idx on public.crm_company_records(workspace_id,publish_state,seq) where deleted_at is null;

create table public.crm_company_backups (
  id uuid primary key default gen_random_uuid(), workspace_id text not null references public.crm_workspaces(id),
  label text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  row_count integer not null default 0
);
create table public.crm_company_backup_rows (
  backup_id uuid not null references public.crm_company_backups(id) on delete cascade,
  seq bigint not null, id text not null, data jsonb not null, primary key(backup_id,seq)
);
create table public.crm_company_imports (
  id uuid primary key default gen_random_uuid(), workspace_id text not null references public.crm_workspaces(id),
  file_hash text not null, file_name text not null, sheet_name text not null, mapping jsonb not null,
  total_rows integer not null check(total_rows between 1 and 250000),
  processed integer not null default 0, inserted integer not null default 0,
  duplicates integer not null default 0, invalid integer not null default 0,
  status text not null default 'running' check(status in ('running','complete','undoing','undone')),
  backup_id uuid references public.crm_company_backups(id),
  undo_cursor bigint not null default 0, undone integer not null default 0, protected integer not null default 0,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index crm_company_import_file_idx on public.crm_company_imports(workspace_id,file_hash,sheet_name) where status <> 'undone';
create table public.crm_company_import_batches (
  import_id uuid not null references public.crm_company_imports(id), start_row integer not null,
  payload_hash text not null, result jsonb not null, primary key(import_id,start_row)
);
create table public.crm_company_import_issues (
  import_id uuid not null references public.crm_company_imports(id), source_row integer not null,
  name text, reason text not null, primary key(import_id,source_row)
);

create function public.crm_company_access(p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.crm_can_access_workspace('ws_akipasa') and
   case when p_write then exists(select 1 from public.profiles where id=auth.uid() and app_role='administrator')
   else public.crm_has_tool('ws_akipasa','crm') end
$$;
create function public.crm_company_key(p_name text,p_address text) returns text
language sql immutable set search_path='' as $$
 select md5(lower(regexp_replace(translate(coalesce(p_name,''),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'),'[^a-zA-Z0-9]','','g')) || '|' ||
 lower(regexp_replace(translate(coalesce(p_address,''),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'),'[^a-zA-Z0-9]','','g')))
$$;

-- Preserve legacy CRM IDs so existing deals and contacts keep their references.
insert into public.crm_company_records(workspace_id,id,data,identity_key,publish_state)
 select s.workspace_id,c->>'id',c,public.crm_company_key(c->>'name',c->>'address'),
 case when nullif(c->>'catalogueVenueId','') is null then 'pending' else 'published' end
 from public.workspace_snapshots s cross join lateral jsonb_array_elements(coalesce(s.data->'companies','[]')) c
 where s.workspace_id='ws_akipasa' and nullif(c->>'id','') is not null
 on conflict do nothing;
insert into public.crm_company_records(workspace_id,id,data,identity_key,publish_state)
 select 'ws_akipasa',v.id::text,jsonb_build_object('id',v.id,'name',v.name,'address',v.address,'city',coalesce(c.name_es,''),
 'website',coalesce(v.website_url,''),'phone',coalesce(v.contact_phone,''),'type','Venue','status','Customer',
 'catalogueVenueId',v.id,'source','AkiPasa','createdAt',v.created_at),public.crm_company_key(v.name,v.address),'published'
 from public.venues v left join public.cities c on c.id=v.city_id
 where not exists(select 1 from public.crm_company_records r where r.workspace_id='ws_akipasa' and r.data->>'catalogueVenueId'=v.id::text)
 on conflict do nothing;

-- Mirror subsequent legacy edits without ever putting bulk companies in a snapshot.
create function public.crm_company_mirror_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.workspace_id <> 'ws_akipasa' then return new; end if;
 insert into public.crm_company_records(workspace_id,id,data,identity_key,publish_state)
 select new.workspace_id,c->>'id',c,public.crm_company_key(c->>'name',c->>'address'),
 case when nullif(c->>'catalogueVenueId','') is null then 'pending' else 'published' end
 from jsonb_array_elements(coalesce(new.data->'companies','[]')) c where nullif(c->>'id','') is not null
 on conflict(workspace_id,id) do update set data=excluded.data, identity_key=excluded.identity_key,
 revision=crm_company_records.revision+1,updated_at=now()
 where crm_company_records.import_id is null and crm_company_records.deleted_at is null
 and crm_company_records.data is distinct from excluded.data
 -- A stale snapshot or live-venue refresh must not overwrite newer company edits.
 and coalesce(excluded.data->>'updatedAt','') > to_char(crm_company_records.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 return new;
end $$;
create trigger crm_company_snapshot_mirror after insert or update of data on public.workspace_snapshots
 for each row execute function public.crm_company_mirror_snapshot();

create function public.crm_company_list(p_search text default '',p_view text default 'all',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare n integer; rows jsonb;
begin
 if not public.crm_company_access() then raise exception 'Company access denied' using errcode='42501'; end if;
 if p_view not in ('all','unpublished','review','imported') or p_offset < 0 or length(p_search)>200 then raise exception 'Invalid filter'; end if;
 select count(*) into n from public.crm_company_records r where workspace_id='ws_akipasa' and deleted_at is null
 and (p_search='' or concat_ws(' ',data->>'name',data->>'city',data->>'address') ilike '%'||p_search||'%')
 and (p_view='all' or p_view='imported' and import_id is not null or p_view='review' and publish_state='skipped'
 or p_view='unpublished' and nullif(data->>'catalogueVenueId','') is null);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
 select id,data,revision,publish_state,publish_error from public.crm_company_records
 where workspace_id='ws_akipasa' and deleted_at is null
 and (p_search='' or concat_ws(' ',data->>'name',data->>'city',data->>'address') ilike '%'||p_search||'%')
 and (p_view='all' or p_view='imported' and import_id is not null or p_view='review' and publish_state='skipped'
 or p_view='unpublished' and nullif(data->>'catalogueVenueId','') is null)
 order by seq desc limit 50 offset p_offset) x;
 return jsonb_build_object('total',n,'rows',rows);
end $$;

create function public.crm_company_backup_create(p_label text default 'Manual backup') returns jsonb
language plpgsql security definer set search_path='' as $$
declare b uuid;n integer;
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtext('crm-company-ws_akipasa'));
 insert into public.crm_company_backups(workspace_id,label,created_by) values('ws_akipasa',left(p_label,200),auth.uid()) returning id into b;
 insert into public.crm_company_backup_rows(backup_id,seq,id,data)
 select b,seq,id,data from public.crm_company_records where workspace_id='ws_akipasa' and deleted_at is null;
 get diagnostics n=row_count;
 update public.crm_company_backups set row_count=n where id=b;
 return jsonb_build_object('id',b,'rows',n);
end $$;

create function public.crm_company_import_start(p_hash text,p_file text,p_sheet text,p_mapping jsonb,p_total integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.crm_company_imports; b jsonb;
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 if p_hash !~ '^[a-f0-9]{64}$' or length(p_file) not between 1 and 250 or length(p_sheet) not between 1 and 100
 or p_total not between 1 and 250000 or jsonb_typeof(p_mapping)<>'object' then raise exception 'Invalid import metadata';end if;
 perform pg_advisory_xact_lock(hashtext('crm-company-ws_akipasa'));
 select * into j from public.crm_company_imports where workspace_id='ws_akipasa' and file_hash=p_hash and sheet_name=p_sheet and status<>'undone';
 if found then
   if j.mapping is distinct from p_mapping or j.total_rows<>p_total then raise exception 'Resume requires the same sheet and field mapping';end if;
   return to_jsonb(j);
 end if;
 b:=public.crm_company_backup_create('Before import: '||p_file);
 insert into public.crm_company_imports(workspace_id,file_hash,file_name,sheet_name,mapping,total_rows,backup_id,created_by)
 values('ws_akipasa',p_hash,p_file,p_sheet,p_mapping,p_total,(b->>'id')::uuid,auth.uid()) returning * into j;
 return to_jsonb(j);
end $$;

create function public.crm_company_import_batch(p_id uuid,p_offset integer,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.crm_company_imports; previous public.crm_company_import_batches; item jsonb; d jsonb;
 n integer; a integer:=0; dup integer:=0; bad integer:=0; i integer:=0; k text; rid text; reason text; result jsonb; h text;
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>2000000 then raise exception 'Batch must contain 1–500 rows within 2 MB';end if;
 h:=md5(p_rows::text); n:=jsonb_array_length(p_rows);
 perform pg_advisory_xact_lock(hashtext('crm-company-ws_akipasa'));
 select * into j from public.crm_company_imports where id=p_id and workspace_id='ws_akipasa' for update;
 if not found then raise exception 'Import not found';end if;
 if j.status in ('undoing','undone') then raise exception 'This import has been undone';end if;
 select * into previous from public.crm_company_import_batches where import_id=p_id and start_row=p_offset;
 if found then
   if previous.payload_hash<>h then raise exception 'Batch differs from the saved batch';end if;
   return previous.result;
 end if;
 if j.status<>'running' or j.processed<>p_offset or p_offset+n>j.total_rows then raise exception 'Resume at saved row %',j.processed;end if;
 for item in select value from jsonb_array_elements(p_rows) loop
   i:=i+1; reason:=null;
   if jsonb_typeof(item)<>'object' or length(trim(coalesce(item->>'name',''))) not between 2 and 180
    or length(trim(coalesce(item->>'address',''))) not between 5 and 300
    or length(coalesce(item->>'city',''))>120 or length(coalesce(item->>'email',''))>254
    or length(coalesce(item->>'website',''))>2000 or length(coalesce(item->>'phone',''))>80
    or length(coalesce(item->>'type',''))>120 or length(coalesce(item->>'externalId',''))>200
    or length(coalesce(item->>'source',''))>2000 then
     reason:='Invalid or missing name/address, or a field is too long';bad:=bad+1;
   else
     k:=public.crm_company_key(item->>'name',item->>'address');
     if exists(select 1 from public.crm_company_records where workspace_id='ws_akipasa' and identity_key=k and deleted_at is null) then
       reason:='Duplicate business name and address';dup:=dup+1;
     else
       rid:='co_'||gen_random_uuid()::text;
       -- Explicit allowlist: incoming IDs, owner, status, timestamps and map links cannot overwrite live state.
       d:=jsonb_build_object('id',rid,'name',trim(item->>'name'),'address',trim(item->>'address'),
        'city',trim(coalesce(item->>'city','')),'email',trim(coalesce(item->>'email','')),
        'website',trim(coalesce(item->>'website','')),'phone',trim(coalesce(item->>'phone','')),
        'type',coalesce(nullif(trim(item->>'type'),''),'Venue'),'source',coalesce(nullif(item->>'source',''),'Excel company import'),
        'externalId',coalesce(item->>'externalId',''),'status','Prospect','ownerId',auth.uid(),'createdAt',now(),
        'sourceRow',p_offset+i+1,'importId',p_id);
       insert into public.crm_company_records(workspace_id,id,data,identity_key,import_id) values('ws_akipasa',rid,d,k,p_id);
       a:=a+1;
     end if;
   end if;
   if reason is not null then insert into public.crm_company_import_issues(import_id,source_row,name,reason)
     values(p_id,p_offset+i+1,left(item->>'name',180),reason);end if;
 end loop;
 update public.crm_company_imports set processed=processed+n,inserted=inserted+a,duplicates=duplicates+dup,invalid=invalid+bad,
 status=case when processed+n=total_rows then 'complete' else 'running' end,updated_at=now() where id=p_id returning * into j;
 result:=to_jsonb(j);
 insert into public.crm_company_import_batches values(p_id,p_offset,h,result);
 -- Refresh planner statistics during a large load, including hosts where autoanalyze lags.
 if j.processed >= 1000 and mod(j.processed,1000)<n then analyze public.crm_company_records;end if;
 return result;
end $$;

create function public.crm_company_history() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 return jsonb_build_object('imports',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from
 (select * from public.crm_company_imports where workspace_id='ws_akipasa' order by created_at desc limit 30)x),
 'backups',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from
 (select * from public.crm_company_backups where workspace_id='ws_akipasa' order by created_at desc limit 30)x));
end $$;

create function public.crm_company_import_undo(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.crm_company_imports; r public.crm_company_records; n integer:=0; kept integer:=0; last_seq bigint; done boolean;
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtext('crm-company-ws_akipasa'));
 select * into j from public.crm_company_imports where id=p_id and workspace_id='ws_akipasa' for update;
 if not found then raise exception 'Import not found';end if;
 if j.status='undone' then return to_jsonb(j);end if;
 last_seq:=j.undo_cursor;
 for r in select * from public.crm_company_records where import_id=p_id and seq>j.undo_cursor order by seq limit 500 for update loop
   last_seq:=r.seq;
   if r.revision=1 and r.deleted_at is null and nullif(r.data->>'catalogueVenueId','') is null
    and r.publish_state<>'working' and not exists(select 1 from public.crm_catalogue_venues where workspace_id=r.workspace_id and lead_id=r.id) then
     update public.crm_company_records set deleted_at=now(),revision=revision+1,updated_at=now() where seq=r.seq;n:=n+1;
   else kept:=kept+1;end if;
 end loop;
 done:=not exists(select 1 from public.crm_company_records where import_id=p_id and seq>last_seq);
 update public.crm_company_imports set status=case when done then 'undone' else 'undoing' end,undo_cursor=last_seq,
 undone=undone+n,protected=protected+kept,updated_at=now() where id=p_id returning * into j;
 return to_jsonb(j);
end $$;

create function public.crm_company_backup_restore(p_id uuid,p_cursor bigint default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.crm_company_backups; r public.crm_company_backup_rows; c bigint:=p_cursor; n integer:=0; changed integer; done boolean;
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 select * into b from public.crm_company_backups where id=p_id and workspace_id='ws_akipasa';
 if not found then raise exception 'Backup not found';end if;
 perform pg_advisory_xact_lock(hashtext('crm-company-ws_akipasa'));
 for r in select * from public.crm_company_backup_rows where backup_id=p_id and seq>p_cursor order by seq limit 500 loop
   c:=r.seq;
   if exists(select 1 from public.crm_company_records where workspace_id='ws_akipasa' and id<>r.id and deleted_at is null
    and identity_key=public.crm_company_key(r.data->>'name',r.data->>'address')) then continue;end if;
   insert into public.crm_company_records(workspace_id,id,data,identity_key,publish_state)
   values('ws_akipasa',r.id,r.data,public.crm_company_key(r.data->>'name',r.data->>'address'),
   case when nullif(r.data->>'catalogueVenueId','') is null then 'pending' else 'published' end)
   on conflict(workspace_id,id) do update set deleted_at=null,revision=crm_company_records.revision+1,updated_at=now()
   where crm_company_records.deleted_at is not null;
   get diagnostics changed=row_count;n:=n+changed;
 end loop;
 done:=not exists(select 1 from public.crm_company_backup_rows where backup_id=p_id and seq>c);
 return jsonb_build_object('cursor',c,'restored',n,'done',done);
end $$;

create function public.crm_company_publish_claim(p_retry boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.crm_company_records; token uuid:=gen_random_uuid();
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 select * into r from public.crm_company_records c where workspace_id='ws_akipasa' and deleted_at is null
 and nullif(data->>'catalogueVenueId','') is null
 and (import_id is null or exists(select 1 from public.crm_company_imports j where j.id=c.import_id and j.status not in ('undoing','undone')))
 and (publish_state='pending' or publish_state='working' and publish_lease<now() or p_retry and publish_state='skipped')
 order by seq for update skip locked limit 1;
 if not found then return null;end if;
 update public.crm_company_records set publish_state='working',publish_token=token,publish_lease=now()+interval '10 minutes' where seq=r.seq;
 return jsonb_build_object('id',r.id,'data',r.data,'token',token);
end $$;

create function public.crm_company_publish_finish(p_id text,p_token uuid,p_error text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 select venue_id into v from public.crm_catalogue_venues where workspace_id='ws_akipasa' and lead_id=p_id;
 update public.crm_company_records set publish_state=case when v is not null then 'published' else 'skipped' end,
 data=case when v is null then data else data||jsonb_build_object('catalogueVenueId',v,'cataloguePublishedAt',now()) end,
 revision=case when v is null then revision else revision+1 end,publish_error=case when v is null then left(coalesce(p_error,'No verified catalogue link returned'),1000) else null end,
 publish_token=null,publish_lease=null,updated_at=now()
 where workspace_id='ws_akipasa' and id=p_id and publish_token=p_token;
 if not found then raise exception 'Publishing lease expired or already completed';end if;
 return jsonb_build_object('published',v is not null,'venue_id',v);
end $$;

create function public.crm_company_save(p_id text,p_revision integer,p_data jsonb,p_archive boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.crm_company_records; d jsonb; k text;
begin
 if not public.crm_company_access(true) then raise exception 'Administrator required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtext('crm-company-ws_akipasa'));
 select * into r from public.crm_company_records where workspace_id='ws_akipasa' and id=p_id and deleted_at is null for update;
 if not found or p_revision is null or r.revision<>p_revision then raise exception 'Company changed. Refresh before saving.' using errcode='40001';end if;
 if r.publish_state='working' then raise exception 'Wait for the current publishing check to finish';end if;
 if p_archive then
   update public.crm_company_records set deleted_at=now(),revision=revision+1,updated_at=now() where seq=r.seq;
   return jsonb_build_object('archived',true);
 end if;
 if length(trim(coalesce(p_data->>'name',''))) not between 2 and 180 or length(trim(coalesce(p_data->>'address',''))) not between 5 and 300
 or length(coalesce(p_data->>'city',''))>120 or length(coalesce(p_data->>'email',''))>254 or length(coalesce(p_data->>'website',''))>2000
 or length(coalesce(p_data->>'phone',''))>80 or length(coalesce(p_data->>'type',''))>120 then raise exception 'Invalid company details';end if;
 k:=public.crm_company_key(p_data->>'name',p_data->>'address');
 if exists(select 1 from public.crm_company_records where workspace_id='ws_akipasa' and identity_key=k and deleted_at is null and id<>p_id) then raise exception 'A company with this name and address already exists';end if;
 d:=r.data||jsonb_build_object('name',trim(p_data->>'name'),'address',trim(p_data->>'address'),'city',coalesce(p_data->>'city',''),
 'email',coalesce(p_data->>'email',''),'website',coalesce(p_data->>'website',''),'phone',coalesce(p_data->>'phone',''),'type',coalesce(p_data->>'type','Venue'));
 update public.crm_company_records set data=d,identity_key=k,revision=revision+1,updated_at=now(),publish_error=null,
 publish_state=case when nullif(data->>'catalogueVenueId','') is null then 'pending' else 'published' end where seq=r.seq;
 return d;
end $$;

-- Table access is read-only; every mutation passes through checked, bounded RPCs.
do $$ declare t text; f record; begin
 foreach t in array array['crm_company_records','crm_company_backups','crm_company_backup_rows','crm_company_imports','crm_company_import_batches','crm_company_import_issues'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public,anon,authenticated',t);
   execute format('grant select on public.%I to authenticated',t);
   execute format('grant all on public.%I to service_role',t);
   execute format('create policy company_admin_read on public.%I for select to authenticated using ((select public.crm_company_access(true)))',t);
 end loop;
 for f in select oid::regprocedure as signature,proname from pg_proc where pronamespace='public'::regnamespace and proname like 'crm_company_%' loop
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
   if f.proname not in ('crm_company_mirror_snapshot','crm_company_key') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
commit;
