-- Narrow printer pairing credentials. No general user/session/service key on the till agent.
begin;
create table akihq_hospitality.printers (
 id uuid primary key default gen_random_uuid(),workspace_id text not null references public.crm_workspaces(id),
 name text not null check(length(name) between 1 and 80),token_hash bytea not null,
 stations text[] not null,authorized_by uuid not null,expires_at timestamptz not null default now()+interval '90 days',
 revoked_at timestamptz,created_at timestamptz not null default now(),last_seen_at timestamptz,
 check(cardinality(stations) between 1 and 3 and stations <@ array['kitchen','bar','receipt'])
);
alter table akihq_hospitality.printers enable row level security;
revoke all on akihq_hospitality.printers from public,anon,authenticated,service_role;
alter table akihq_hospitality.tickets add column printer_id uuid references akihq_hospitality.printers(id);
alter table akihq_hospitality.tickets drop constraint tickets_status_check;
alter table akihq_hospitality.tickets add constraint tickets_status_check check(status in ('queued','claimed','confirmed','uncertain','spooled'));
create or replace function akihq_hospitality.protect_ticket() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Retain the original ticket'; end if;
 if (to_jsonb(new)-array['status','claimed_by','claimed_at','printer_id']) is distinct from (to_jsonb(old)-array['status','claimed_by','claimed_at','printer_id']) then raise exception 'Ticket contents are immutable'; end if;
 return new;
end $$;
create function public.crm_printer_manage(p_workspace text,p_action text,p_details jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare token text; device akihq_hospitality.printers; result jsonb;
begin
 perform akihq_hospitality.guard(p_workspace);
 if not akihq_security.can_administer(p_workspace) then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(p)-'token_hash' order by created_at desc) from akihq_hospitality.printers p where workspace_id=p_workspace),'[]');
 elsif p_action='pair' then
  if (select count(*) from akihq_hospitality.printers where workspace_id=p_workspace and revoked_at is null and expires_at>now())>=20 then raise exception 'Revoke unused devices first (maximum 20)'; end if;
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  if jsonb_typeof(p_details->'stations') is distinct from 'array' then raise exception 'Stations required'; end if;
  insert into akihq_hospitality.printers(workspace_id,name,token_hash,stations,authorized_by)
  values(p_workspace,btrim(p_details->>'name'),sha256(convert_to(token,'UTF8')),array(select jsonb_array_elements_text(p_details->'stations')),auth.uid()) returning * into device;
  result:=jsonb_build_object('device_id',device.id,'token',token,'workspace_id',p_workspace,'expires_at',device.expires_at,'stations',device.stations);
 elsif p_action='revoke' then
  update akihq_hospitality.printers set revoked_at=now() where id=(p_details->>'id')::uuid and workspace_id=p_workspace returning * into device;
  if not found then raise exception 'Device not found'; end if;
  result:=jsonb_build_object('revoked',true);
 else raise exception 'Unknown printer operation'; end if;
 insert into akihq_hospitality.events(workspace_id,actor,command_id,action,metadata) values(p_workspace,auth.uid(),gen_random_uuid(),'printer_'||p_action,jsonb_build_object('device_id',device.id,'name',device.name,'stations',device.stations));
 return result;
end $$;
create function akihq_hospitality.printer_guard(p_device uuid,p_token text) returns akihq_hospitality.printers
language plpgsql set search_path='' as $$
declare d akihq_hospitality.printers;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Printer authorization required' using errcode='42501'; end if;
 select * into d from akihq_hospitality.printers where id=p_device and token_hash=sha256(convert_to(p_token,'UTF8')) and revoked_at is null and expires_at>now();
 if not found or not exists(select 1 from public.crm_workspaces w join public.crm_workspace_entitlements e on e.workspace_id=w.id where w.id=d.workspace_id and w.status in ('active','trial') and e.tool_key='pos' and e.active and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()))
 or not exists(select 1 from public.crm_workspace_members m where m.workspace_id=d.workspace_id and m.profile_id=d.authorized_by and m.status='active' and (m.role='owner' or (m.role='admin' and (m.role_template_id is null or exists(select 1 from public.crm_role_templates rt join public.crm_role_template_tools tt on tt.template_id=rt.id where rt.id=m.role_template_id and rt.workspace_id=d.workspace_id and tt.tool_key='pos'))))) then
 raise exception 'Printer authorization expired or revoked' using errcode='42501'; end if;
 return d;
end $$;
-- Deliberately token-scoped RPC: only a paired device can access its permitted station.
create function public.crm_printer_next(p_device uuid,p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d akihq_hospitality.printers; t akihq_hospitality.tickets; result jsonb;
begin
 d:=akihq_hospitality.printer_guard(p_device,p_token);
 perform pg_advisory_xact_lock(hashtextextended('akihq-hospitality:'||d.workspace_id,0));
 -- Revalidate after acquiring the same lock used by order commands.
 d:=akihq_hospitality.printer_guard(p_device,p_token);
 update akihq_hospitality.printers set last_seen_at=now() where id=d.id;
 select * into t from akihq_hospitality.tickets where workspace_id=d.workspace_id and status='queued' and station=any(d.stations) order by created_at,id limit 1 for update;
 if not found then return null; end if;
 update akihq_hospitality.tickets set status='claimed',claimed_by=d.authorized_by,claimed_at=now(),printer_id=d.id where id=t.id returning * into t;
 insert into akihq_hospitality.events(workspace_id,order_id,actor,command_id,action,metadata) values(d.workspace_id,t.order_id,d.authorized_by,gen_random_uuid(),'printer_claim',jsonb_build_object('device_id',d.id,'ticket_id',t.id));
 select to_jsonb(t)||jsonb_build_object('business_name',w.name,'currency',w.currency) into result from public.crm_workspaces w where w.id=d.workspace_id;
 return result;
end $$;
create function public.crm_printer_report(p_device uuid,p_token text,p_ticket uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d akihq_hospitality.printers; t akihq_hospitality.tickets;
begin
 d:=akihq_hospitality.printer_guard(p_device,p_token);
 perform pg_advisory_xact_lock(hashtextextended('akihq-hospitality:'||d.workspace_id,0));
 d:=akihq_hospitality.printer_guard(p_device,p_token);
 select * into t from akihq_hospitality.tickets where id=p_ticket and workspace_id=d.workspace_id and printer_id=d.id and station=any(d.stations) for update;
 if not found then raise exception 'Printer ticket not found'; end if;
 if p_action='begin' then
  -- A duplicate begin is never permission to print again.
  if t.status<>'claimed' then raise exception 'Print already attempted; inspect printer and request a marked copy'; end if;
  update akihq_hospitality.tickets set status='uncertain' where id=t.id;
 elsif p_action='spooled' then
  if t.status='spooled' then return '{"status":"spooled"}'; end if;
  if t.status<>'uncertain' then raise exception 'Record an attempt before spooling'; end if;
  update akihq_hospitality.tickets set status='spooled' where id=t.id;
 elsif p_action='uncertain' then
  if t.status not in ('claimed','uncertain') then raise exception 'Invalid print state'; end if;
  update akihq_hospitality.tickets set status='uncertain' where id=t.id;
 else raise exception 'Unknown printer status'; end if;
 insert into akihq_hospitality.events(workspace_id,order_id,actor,command_id,action,metadata) values(d.workspace_id,t.order_id,d.authorized_by,gen_random_uuid(),'printer_'||p_action,jsonb_build_object('device_id',d.id,'ticket_id',t.id));
 return jsonb_build_object('status',case when p_action='spooled' then 'spooled' else 'uncertain' end);
end $$;
revoke all on function akihq_hospitality.printer_guard(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.crm_printer_manage(text,text,jsonb) from public,anon;
grant execute on function public.crm_printer_manage(text,text,jsonb) to authenticated;
revoke all on function public.crm_printer_next(uuid,text),public.crm_printer_report(uuid,text,uuid,text) from public;
grant execute on function public.crm_printer_next(uuid,text),public.crm_printer_report(uuid,text,uuid,text) to anon,authenticated;
create or replace function public.crm_hospitality_overview(p_workspace text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform akihq_hospitality.guard(p_workspace);
 select jsonb_build_object('layout',coalesce((select layout from akihq_hospitality.rooms where workspace_id=p_workspace),'{"mode":"till","pages":[],"tables":[]}'::jsonb),
 'layout_version',coalesce((select version from akihq_hospitality.rooms where workspace_id=p_workspace),0),
 'can_manage',akihq_security.can_administer(p_workspace),'can_export',akihq_security.can_export(p_workspace,'pos'),
 'orders',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('total_cents',akihq_hospitality.total(o.lines),'paid_cents',akihq_hospitality.paid(o.payments)) order by o.created_at) from akihq_hospitality.orders o where workspace_id=p_workspace and status='open'),'[]'),
 'tickets',coalesce((select jsonb_agg(to_jsonb(t)) from (select id,order_id,station,kind,status,created_at,claimed_at,claimed_by from akihq_hospitality.tickets where workspace_id=p_workspace order by case when status in ('confirmed','spooled') then 1 else 0 end,created_at limit 100) t),'[]'),
 'recent',coalesce((select jsonb_agg(to_jsonb(o)) from (select id,label,status,sale_id,updated_at from akihq_hospitality.orders where workspace_id=p_workspace and status<>'open' order by updated_at desc limit 30)o),'[]'),
 'catalogue',public.crm_pos_catalogue(p_workspace),'server_time',now()) into result;
 return result;
end $$;

commit;
