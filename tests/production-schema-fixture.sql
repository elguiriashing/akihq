-- Schema-only production metadata captured 2026-09-25; no customer rows.
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;grant usage on schema auth,public to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text);
create type public.app_role as enum('consumer','business','moderator','administrator');
create type public.venue_member_role as enum('owner','manager','editor');
-- Eligibility is an explicit fixture variable, not real billing.
create function public.has_active_entitlement(uuid,text) returns boolean language sql stable as $$select coalesce(current_setting('test.business_eligible',true),'true')='true'$$;
create table public.crm_inventory_items("id" uuid default gen_random_uuid() not null,"workspace_id" text not null,"sku" text not null,"name" text not null,"unit" text default 'unit'::text not null,"on_hand" numeric(14,3) default 0 not null,"reorder_point" numeric(14,3) default 0 not null,"safety_stock" numeric(14,3) default 0 not null,"lead_time_days" integer default 3 not null,"active" boolean default true not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"category" text default 'General'::text not null,"cost_cents" integer default 0 not null,"sale_price_cents" integer default 0 not null);
alter table public.crm_inventory_items enable row level security;grant all on public.crm_inventory_items to authenticated,service_role;
create table public.crm_inventory_movements("id" uuid default gen_random_uuid() not null,"workspace_id" text not null,"item_id" uuid not null,"quantity_delta" numeric(14,3) not null,"movement_type" text not null,"source_type" text,"source_id" text,"employee_profile_id" uuid,"notes" text default ''::text not null,"occurred_at" timestamp with time zone default now() not null,"created_at" timestamp with time zone default now() not null,"created_by" uuid not null);
alter table public.crm_inventory_movements enable row level security;grant all on public.crm_inventory_movements to authenticated,service_role;
create table public.crm_pos_sale_lines("id" uuid default gen_random_uuid() not null,"sale_id" uuid not null,"workspace_id" text not null,"item_id" uuid not null,"quantity" numeric(14,3) not null,"unit_price_cents" integer not null,"created_at" timestamp with time zone default now() not null);
alter table public.crm_pos_sale_lines enable row level security;grant all on public.crm_pos_sale_lines to authenticated,service_role;
create table public.crm_pos_sales("id" uuid default gen_random_uuid() not null,"workspace_id" text not null,"provider" text not null,"external_id" text not null,"status" text default 'completed'::text not null,"employee_profile_id" uuid,"total_cents" integer not null,"currency" text default 'EUR'::text not null,"sold_at" timestamp with time zone default now() not null,"created_at" timestamp with time zone default now() not null,"created_by" uuid not null,"tip_cents" integer default 0 not null,"tipped_profile_id" uuid);
alter table public.crm_pos_sales enable row level security;grant all on public.crm_pos_sales to authenticated,service_role;
create table public.crm_role_template_tools("template_id" uuid not null,"tool_key" text not null);
alter table public.crm_role_template_tools enable row level security;grant all on public.crm_role_template_tools to authenticated,service_role;
create table public.crm_role_templates("id" uuid default gen_random_uuid() not null,"workspace_id" text not null,"name" text not null,"description" text default ''::text not null,"created_by" uuid not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
alter table public.crm_role_templates enable row level security;grant all on public.crm_role_templates to authenticated,service_role;
create table public.crm_support_contacts("id" uuid default gen_random_uuid() not null,"workspace_id" text not null,"email" text not null,"name" text default ''::text not null,"created_at" timestamp with time zone default now() not null);
alter table public.crm_support_contacts enable row level security;grant all on public.crm_support_contacts to authenticated,service_role;
create table public.crm_support_mailboxes("id" uuid default gen_random_uuid() not null,"workspace_id" text not null,"address" text not null,"active" boolean default false not null,"verified_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null);
alter table public.crm_support_mailboxes enable row level security;grant all on public.crm_support_mailboxes to authenticated,service_role;
create table public.crm_support_messages("id" uuid default gen_random_uuid() not null,"workspace_id" text not null,"ticket_id" uuid not null,"mailbox_id" uuid not null,"direction" text not null,"author_kind" text not null,"text" text not null,"message_id" text,"in_reply_to" text,"request_id" uuid,"attachments" jsonb default '[]'::jsonb not null,"original_key" text,"delivery_status" text default 'received'::text not null,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
alter table public.crm_support_messages enable row level security;grant all on public.crm_support_messages to authenticated,service_role;
create table public.crm_support_tickets("id" uuid default gen_random_uuid() not null,"workspace_id" text not null,"number" bigint not null,"mailbox_id" uuid not null,"contact_id" uuid not null,"subject" text not null,"status" text default 'new'::text not null,"priority" text default 'normal'::text not null,"assigned_to" uuid,"human_control" boolean default false not null,"handover_reason" text default ''::text not null,"ai_replies" integer default 0 not null,"ai_draft" text default ''::text not null,"version" integer default 1 not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
alter table public.crm_support_tickets enable row level security;grant all on public.crm_support_tickets to authenticated,service_role;
create table public.crm_tool_catalog("tool_key" text not null,"name" text not null,"description" text default ''::text not null,"category" text default 'workspace'::text not null,"billable" boolean default false not null,"sort_order" integer default 0 not null,"active" boolean default true not null);
alter table public.crm_tool_catalog enable row level security;grant all on public.crm_tool_catalog to authenticated,service_role;
create table public.crm_workspace_entitlements("workspace_id" text not null,"tool_key" text not null,"active" boolean default true not null,"source" text default 'plan'::text not null,"limits" jsonb default '{}'::jsonb not null,"starts_at" timestamp with time zone default now() not null,"ends_at" timestamp with time zone,"updated_at" timestamp with time zone default now() not null);
alter table public.crm_workspace_entitlements enable row level security;grant all on public.crm_workspace_entitlements to authenticated,service_role;
create table public.crm_workspace_members("workspace_id" text not null,"profile_id" uuid not null,"role" text not null,"status" text default 'active'::text not null,"invited_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"role_template_id" uuid);
alter table public.crm_workspace_members enable row level security;grant all on public.crm_workspace_members to authenticated,service_role;
create table public.crm_workspace_records("workspace_id" text not null,"record_type" text not null,"record_id" text not null,"data" jsonb not null,"updated_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
alter table public.crm_workspace_records enable row level security;grant all on public.crm_workspace_records to authenticated,service_role;
create table public.crm_workspaces("id" text not null,"name" text not null,"slug" text not null,"owner_profile_id" uuid,"source_venue_id" uuid,"plan" text default 'starter'::text not null,"status" text default 'active'::text not null,"seat_limit" integer default 4 not null,"timezone" text default 'Europe/Madrid'::text not null,"currency" text default 'EUR'::text not null,"settings" jsonb default '{}'::jsonb not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"business_category" text);
alter table public.crm_workspaces enable row level security;grant all on public.crm_workspaces to authenticated,service_role;
create table public.profiles("id" uuid not null,"display_name" text,"preferred_locale" text default 'es'::text not null,"app_role" app_role default 'consumer'::app_role not null,"terms_version" text,"terms_accepted_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"username" text,"avatar_url" text,"banner_url" text,"bio" text,"public_email" text,"phone" text,"website_url" text,"instagram_url" text,"locality" text,"province" text,"birth_year" smallint,"gender" text,"profile_visibility" text default 'public'::text not null,"contact_visibility" text default 'private'::text not null,"attendance_visibility" text default 'private'::text not null,"business_tier" text default 'none'::text not null,"business_plan_active" boolean default false not null);
alter table public.profiles enable row level security;grant all on public.profiles to authenticated,service_role;
create table public.workspace_snapshots("workspace_id" text not null,"updated_by" uuid,"data" jsonb not null,"updated_at" timestamp with time zone default now() not null);
alter table public.workspace_snapshots enable row level security;grant all on public.workspace_snapshots to authenticated,service_role;
alter table public.crm_inventory_items add constraint "crm_inventory_items_cost_cents_check" CHECK ((cost_cents >= 0));
alter table public.crm_inventory_items add constraint "crm_inventory_items_lead_time_days_check" CHECK (((lead_time_days >= 0) AND (lead_time_days <= 365)));
alter table public.crm_inventory_items add constraint "crm_inventory_items_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 160)));
alter table public.crm_inventory_items add constraint "crm_inventory_items_on_hand_check" CHECK ((on_hand >= (0)::numeric));
alter table public.crm_inventory_items add constraint "crm_inventory_items_pkey" PRIMARY KEY (id);
alter table public.crm_inventory_items add constraint "crm_inventory_items_sale_price_cents_check" CHECK ((sale_price_cents >= 0));
alter table public.crm_inventory_items add constraint "crm_inventory_items_workspace_id_sku_key" UNIQUE (workspace_id, sku);
alter table public.crm_inventory_movements add constraint "crm_inventory_movements_movement_type_check" CHECK ((movement_type = ANY (ARRAY['opening'::text, 'purchase'::text, 'sale'::text, 'waste'::text, 'count'::text, 'transfer'::text, 'return'::text, 'adjustment'::text])));
alter table public.crm_inventory_movements add constraint "crm_inventory_movements_pkey" PRIMARY KEY (id);
alter table public.crm_inventory_movements add constraint "crm_inventory_movements_quantity_delta_check" CHECK ((quantity_delta <> (0)::numeric));
alter table public.crm_pos_sale_lines add constraint "crm_pos_sale_lines_pkey" PRIMARY KEY (id);
alter table public.crm_pos_sale_lines add constraint "crm_pos_sale_lines_quantity_check" CHECK ((quantity > (0)::numeric));
alter table public.crm_pos_sale_lines add constraint "crm_pos_sale_lines_unit_price_cents_check" CHECK ((unit_price_cents >= 0));
alter table public.crm_pos_sales add constraint "crm_pos_sales_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text));
alter table public.crm_pos_sales add constraint "crm_pos_sales_pkey" PRIMARY KEY (id);
alter table public.crm_pos_sales add constraint "crm_pos_sales_status_check" CHECK ((status = ANY (ARRAY['completed'::text, 'voided'::text, 'refunded'::text])));
alter table public.crm_pos_sales add constraint "crm_pos_sales_tip_cents_check" CHECK ((tip_cents >= 0));
alter table public.crm_pos_sales add constraint "crm_pos_sales_total_cents_check" CHECK ((total_cents >= 0));
alter table public.crm_pos_sales add constraint "crm_pos_sales_workspace_id_provider_external_id_key" UNIQUE (workspace_id, provider, external_id);
alter table public.crm_role_template_tools add constraint "crm_role_template_tools_pkey" PRIMARY KEY (template_id, tool_key);
alter table public.crm_role_templates add constraint "crm_role_templates_description_check" CHECK ((char_length(description) <= 240));
alter table public.crm_role_templates add constraint "crm_role_templates_name_check" CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 60)));
alter table public.crm_role_templates add constraint "crm_role_templates_pkey" PRIMARY KEY (id);
alter table public.crm_role_templates add constraint "crm_role_templates_workspace_id_name_key" UNIQUE (workspace_id, name);
alter table public.crm_support_contacts add constraint "crm_support_contacts_email_check" CHECK ((email = lower(email)));
alter table public.crm_support_contacts add constraint "crm_support_contacts_pkey" PRIMARY KEY (id);
alter table public.crm_support_contacts add constraint "crm_support_contacts_workspace_id_email_key" UNIQUE (workspace_id, email);
alter table public.crm_support_contacts add constraint "crm_support_contacts_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table public.crm_support_mailboxes add constraint "crm_support_mailboxes_address_check" CHECK (((address = lower(address)) AND (address ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text)));
alter table public.crm_support_mailboxes add constraint "crm_support_mailboxes_address_key" UNIQUE (address);
alter table public.crm_support_mailboxes add constraint "crm_support_mailboxes_pkey" PRIMARY KEY (id);
alter table public.crm_support_mailboxes add constraint "crm_support_mailboxes_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table public.crm_support_messages add constraint "crm_support_messages_author_kind_check" CHECK ((author_kind = ANY (ARRAY['customer'::text, 'human'::text, 'ai'::text])));
alter table public.crm_support_messages add constraint "crm_support_messages_check" CHECK (((original_key IS NULL) OR ("left"(original_key, (char_length(workspace_id) + 1)) = (workspace_id || '/'::text))));
alter table public.crm_support_messages add constraint "crm_support_messages_delivery_status_check" CHECK ((delivery_status = ANY (ARRAY['received'::text, 'queued'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'uncertain'::text, 'cancelled'::text, 'internal'::text])));
alter table public.crm_support_messages add constraint "crm_support_messages_direction_check" CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text, 'note'::text])));
alter table public.crm_support_messages add constraint "crm_support_messages_mailbox_id_message_id_key" UNIQUE (mailbox_id, message_id);
alter table public.crm_support_messages add constraint "crm_support_messages_pkey" PRIMARY KEY (id);
alter table public.crm_support_messages add constraint "crm_support_messages_text_check" CHECK ((char_length(text) <= 20000));
alter table public.crm_support_messages add constraint "crm_support_messages_workspace_id_ticket_id_request_id_key" UNIQUE (workspace_id, ticket_id, request_id);
alter table public.crm_support_tickets add constraint "crm_support_tickets_pkey" PRIMARY KEY (id);
alter table public.crm_support_tickets add constraint "crm_support_tickets_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));
alter table public.crm_support_tickets add constraint "crm_support_tickets_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'ai_active'::text, 'needs_human'::text, 'in_progress'::text, 'waiting_customer'::text, 'resolved'::text, 'spam'::text])));
alter table public.crm_support_tickets add constraint "crm_support_tickets_subject_check" CHECK ((char_length(subject) <= 500));
alter table public.crm_support_tickets add constraint "crm_support_tickets_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table public.crm_support_tickets add constraint "crm_support_tickets_workspace_id_id_mailbox_id_key" UNIQUE (workspace_id, id, mailbox_id);
alter table public.crm_support_tickets add constraint "crm_support_tickets_workspace_id_number_key" UNIQUE (workspace_id, number);
alter table public.crm_tool_catalog add constraint "crm_tool_catalog_pkey" PRIMARY KEY (tool_key);
alter table public.crm_tool_catalog add constraint "crm_tool_catalog_tool_key_check" CHECK ((tool_key ~ '^[a-z][a-z0-9_-]{1,47}$'::text));
alter table public.crm_workspace_entitlements add constraint "crm_workspace_entitlements_check" CHECK (((ends_at IS NULL) OR (ends_at > starts_at)));
alter table public.crm_workspace_entitlements add constraint "crm_workspace_entitlements_limits_check" CHECK ((jsonb_typeof(limits) = 'object'::text));
alter table public.crm_workspace_entitlements add constraint "crm_workspace_entitlements_pkey" PRIMARY KEY (workspace_id, tool_key);
alter table public.crm_workspace_entitlements add constraint "crm_workspace_entitlements_source_check" CHECK ((source = ANY (ARRAY['plan'::text, 'trial'::text, 'purchase'::text, 'manual'::text, 'platform'::text])));
alter table public.crm_workspace_members add constraint "crm_workspace_members_pkey" PRIMARY KEY (workspace_id, profile_id);
alter table public.crm_workspace_members add constraint "crm_workspace_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'staff'::text, 'viewer'::text])));
alter table public.crm_workspace_members add constraint "crm_workspace_members_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])));
alter table public.crm_workspace_records add constraint "crm_workspace_records_data_check" CHECK ((jsonb_typeof(data) = 'object'::text));
alter table public.crm_workspace_records add constraint "crm_workspace_records_pkey" PRIMARY KEY (workspace_id, record_type, record_id);
alter table public.crm_workspace_records add constraint "crm_workspace_records_record_type_check" CHECK ((record_type = ANY (ARRAY['event'::text, 'article'::text])));
alter table public.crm_workspaces add constraint "crm_workspaces_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text));
alter table public.crm_workspaces add constraint "crm_workspaces_id_check" CHECK ((id ~ '^[a-z0-9][a-z0-9_-]{2,79}$'::text));
alter table public.crm_workspaces add constraint "crm_workspaces_name_check" CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 120)));
alter table public.crm_workspaces add constraint "crm_workspaces_pkey" PRIMARY KEY (id);
alter table public.crm_workspaces add constraint "crm_workspaces_plan_check" CHECK ((plan = ANY (ARRAY['starter'::text, 'growth'::text, 'pro'::text, 'platform'::text])));
alter table public.crm_workspaces add constraint "crm_workspaces_seat_limit_check" CHECK (((seat_limit >= 1) AND (seat_limit <= 100)));
alter table public.crm_workspaces add constraint "crm_workspaces_settings_check" CHECK ((jsonb_typeof(settings) = 'object'::text));
alter table public.crm_workspaces add constraint "crm_workspaces_slug_check" CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text));
alter table public.crm_workspaces add constraint "crm_workspaces_slug_key" UNIQUE (slug);
alter table public.crm_workspaces add constraint "crm_workspaces_source_venue_id_key" UNIQUE (source_venue_id);
alter table public.crm_workspaces add constraint "crm_workspaces_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'trial'::text, 'suspended'::text, 'closed'::text])));
alter table public.profiles add constraint "profiles_business_tier_check" CHECK ((business_tier = ANY (ARRAY['none'::text, 'business'::text, 'business_pro'::text])));
alter table public.profiles add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public.profiles add constraint "profiles_preferred_locale_check" CHECK ((preferred_locale = ANY (ARRAY['es'::text, 'en'::text])));
alter table public.profiles add constraint "profiles_public_privacy_values" CHECK (((profile_visibility = ANY (ARRAY['public'::text, 'members'::text, 'private'::text])) AND (contact_visibility = ANY (ARRAY['public'::text, 'members'::text, 'private'::text])) AND (attendance_visibility = ANY (ARRAY['public'::text, 'members'::text, 'private'::text])) AND ((birth_year IS NULL) OR ((birth_year >= 1900) AND (birth_year <= (EXTRACT(year FROM CURRENT_DATE))::integer)))));
alter table public.profiles add constraint "profiles_public_urls" CHECK ((((avatar_url IS NULL) OR (avatar_url ~ '^https://'::text)) AND ((banner_url IS NULL) OR (banner_url ~ '^https://'::text)) AND ((website_url IS NULL) OR (website_url ~ '^https://'::text)) AND ((instagram_url IS NULL) OR (instagram_url ~ '^https://'::text))));
alter table public.profiles add constraint "profiles_terms_acceptance_consistent" CHECK ((((terms_version IS NULL) AND (terms_accepted_at IS NULL)) OR ((terms_version IS NOT NULL) AND (terms_accepted_at IS NOT NULL))));
alter table public.profiles add constraint "profiles_username_format" CHECK (((username IS NULL) OR (username ~ '^[a-zA-Z0-9_]{3,30}$'::text)));
alter table public.workspace_snapshots add constraint "workspace_snapshots_data_check" CHECK ((jsonb_typeof(data) = 'object'::text));
alter table public.workspace_snapshots add constraint "workspace_snapshots_pkey" PRIMARY KEY (workspace_id);
set check_function_bodies=off;
CREATE OR REPLACE FUNCTION public.crm_add_workspace_member(p_workspace text, p_email text, p_role text DEFAULT 'staff'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile uuid;
  v_limit integer;
  v_count integer;
  v_venue uuid;
  v_venue_role public.venue_member_role;
begin
  if not public.crm_can_manage_workspace(p_workspace) then raise exception 'workspace manager required'; end if;
  if p_role not in ('admin','manager','staff','viewer') then raise exception 'invalid workspace role'; end if;
  select user_record.id into v_profile
  from auth.users user_record
  where lower(user_record.email) = lower(btrim(p_email))
  limit 1;
  if v_profile is null then raise exception 'that account must sign in to AkiPasa once before it can be added'; end if;
  select workspace.seat_limit,workspace.source_venue_id into strict v_limit,v_venue
  from public.crm_workspaces workspace where workspace.id = p_workspace for update;
  if v_venue is null then raise exception 'venue-backed workspace required'; end if;
  select count(*) into v_count
  from public.crm_workspace_members member
  where member.workspace_id = p_workspace and member.status = 'active';
  if v_count >= v_limit and not exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = v_profile
  ) then raise exception 'workspace seat limit reached'; end if;

  v_venue_role := case when p_role in ('admin','manager')
    then 'manager'::public.venue_member_role else 'editor'::public.venue_member_role end;
  insert into public.venue_members as venue_member (venue_id,profile_id,role)
  values (v_venue,v_profile,v_venue_role)
  on conflict (venue_id,profile_id) do update
  set role = case
    when venue_member.role = 'owner'::public.venue_member_role then venue_member.role
    else excluded.role
  end;

  insert into public.crm_workspace_members (workspace_id,profile_id,role,status,invited_by)
  values (p_workspace,v_profile,p_role,'active',(select auth.uid()))
  on conflict (workspace_id,profile_id) do update
  set role = excluded.role,status = 'active',invited_by = excluded.invited_by,updated_at = now();
  return jsonb_build_object('workspace_id',p_workspace,'profile_id',v_profile,'role',p_role);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.crm_add_workspace_member(p_workspace text, p_email text, p_role_template uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_profile uuid; v_limit integer; v_count integer;
begin
  if not public.crm_can_administer_people(p_workspace) then raise exception 'workspace owner or admin required'; end if;
  if not exists(select 1 from public.crm_role_templates where id=p_role_template and workspace_id=p_workspace) then raise exception 'role template not found'; end if;
  select id into v_profile from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if v_profile is null then raise exception 'that account must sign in to AkiPasa once before it can be added'; end if;
  select seat_limit into strict v_limit from public.crm_workspaces where id=p_workspace for update;
  select count(*) into v_count from public.crm_workspace_members where workspace_id=p_workspace and status='active';
  if v_count >= v_limit and not exists(select 1 from public.crm_workspace_members where workspace_id=p_workspace and profile_id=v_profile)
    then raise exception 'workspace seat limit reached'; end if;
  insert into public.crm_workspace_members(workspace_id,profile_id,role,role_template_id,status,invited_by)
  values(p_workspace,v_profile,'staff',p_role_template,'active',(select auth.uid()))
  on conflict(workspace_id,profile_id) do update set role='staff',role_template_id=excluded.role_template_id,status='active',invited_by=excluded.invited_by,updated_at=now();
  return jsonb_build_object('workspace_id',p_workspace,'profile_id',v_profile,'role_template_id',p_role_template);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.crm_apply_inventory_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.crm_inventory_items item
  set on_hand = item.on_hand + new.quantity_delta, updated_at = now()
  where item.id = new.item_id and item.workspace_id = new.workspace_id;
  if not found then raise exception 'inventory item does not belong to workspace'; end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.crm_can_access_workspace(p_workspace text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null and (
    exists(select 1 from public.crm_workspace_members member join public.crm_workspaces workspace on workspace.id=member.workspace_id
      where member.workspace_id=p_workspace and member.profile_id=(select auth.uid()) and member.status='active'
        and workspace.status in ('active','trial') and (workspace.id='ws_akipasa' or public.has_active_entitlement(workspace.owner_profile_id,'business')))
    or exists(select 1 from public.profiles where id=(select auth.uid()) and app_role='administrator')
  );
$function$
;
CREATE OR REPLACE FUNCTION public.crm_can_administer_people(p_workspace text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace
      and member.profile_id = (select auth.uid())
      and member.status = 'active'
      and member.role in ('owner','admin')
  ) or exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid()) and profile.app_role = 'administrator'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.crm_can_manage_workspace(p_workspace text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.crm_workspace_members member
      where member.workspace_id = p_workspace
        and member.profile_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner','admin','manager')
    )
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.app_role = 'administrator'::public.app_role
    )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.crm_can_operate_workspace(p_workspace text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.crm_workspace_members member
      where member.workspace_id = p_workspace
        and member.profile_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner','admin','manager','staff')
    )
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.app_role = 'administrator'::public.app_role
    )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.crm_has_tool(p_workspace text, p_tool text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.crm_can_access_workspace(p_workspace) and exists (
    select 1
    from public.crm_workspace_entitlements entitlement
    where entitlement.workspace_id = p_workspace
      and entitlement.tool_key = p_tool
      and entitlement.active
      and entitlement.starts_at <= now()
      and (entitlement.ends_at is null or entitlement.ends_at > now())
  );
$function$
;
CREATE OR REPLACE FUNCTION public.crm_member_has_tool(p_workspace text, p_tool text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.crm_has_tool(p_workspace,p_tool) and exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace
      and member.profile_id = (select auth.uid())
      and member.status = 'active'
      and (
        member.role = 'owner'
        or (member.role = 'admin' and member.role_template_id is null)
        or exists (
          select 1 from public.crm_role_template_tools permitted
          where permitted.template_id = member.role_template_id and permitted.tool_key = p_tool
        )
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.crm_remove_workspace_member(p_workspace text, p_profile uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue uuid;
begin
  if not public.crm_can_manage_workspace(p_workspace) then raise exception 'workspace manager required'; end if;
  if exists (
    select 1 from public.crm_workspace_members member
    where member.workspace_id = p_workspace and member.profile_id = p_profile and member.role = 'owner'
  ) then raise exception 'workspace owners cannot be removed'; end if;

  select workspace.source_venue_id into v_venue
  from public.crm_workspaces workspace where workspace.id = p_workspace;
  if v_venue is not null then
    delete from public.venue_members member
    where member.venue_id = v_venue and member.profile_id = p_profile;
  end if;
  delete from public.crm_workspace_members member
  where member.workspace_id = p_workspace and member.profile_id = p_profile;
end;
$function$
;
set check_function_bodies=on;
create trigger crm_inventory_movement_apply after insert on public.crm_inventory_movements for each row execute function public.crm_apply_inventory_movement();

