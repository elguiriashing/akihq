-- Additive fiscal preparation. No existing operational sale becomes a fiscal invoice.
-- This migration deliberately ships with no approved release and no tax adapter.
begin;
create schema if not exists fiscal_private;
revoke all on schema fiscal_private from public,anon;
grant usage on schema fiscal_private to authenticated,service_role;

create table public.crm_fiscal_releases (
  version text primary key,
  status text not null default 'draft' check(status in ('draft','approved','withdrawn')),
  declaration_url text,
  declaration_sha256 text check(declaration_sha256 is null or declaration_sha256 ~ '^[a-fA-F0-9]{64}$'),
  transport_adapter text,
  validation_evidence_url text,
  approved_at timestamptz,
  check(status <> 'approved' or (declaration_url like 'https://%' and declaration_sha256 is not null and nullif(transport_adapter,'') is not null and validation_evidence_url like 'https://%' and approved_at is not null))
);
insert into public.crm_fiscal_releases(version) values('akihq-fiscal-0.1');
create table public.crm_fiscal_profiles (
  workspace_id text primary key references public.crm_workspaces(id) on delete restrict,
  legal_name text not null check(length(legal_name) between 2 and 120),
  tax_id text not null check(tax_id ~ '^[A-Z0-9]{9}$'),
  address text not null check(length(address) between 3 and 250),
  postal_code text not null check(postal_code ~ '^[0-9]{5}$'),
  city text not null check(length(city) between 2 and 120),
  country text not null default 'ES' check(country='ES'),
  jurisdiction text not null default 'common_territory' check(jurisdiction='common_territory'),
  tax_regime text not null default 'general' check(tax_regime='general'),
  currency text not null default 'EUR' check(currency='EUR'),
  sii boolean not null default false check(not sii),
  simplified_limit_cents integer not null default 40000 check(simplified_limit_cents in (40000,300000)),
  eligible_activity text not null default '',
  release_version text not null default 'akihq-fiscal-0.1' references public.crm_fiscal_releases(version),
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  check(simplified_limit_cents=40000 or length(btrim(eligible_activity))>=5)
);
create table public.crm_fiscal_item_taxes (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  item_id uuid not null references public.crm_inventory_items(id) on delete restrict,
  rate_bps integer not null check(rate_bps in (0,400,1000,2100)),
  treatment text not null default 'taxable' check(treatment in ('taxable','zero_rated','exempt')),
  reason text not null default '',
  valid_from date not null,
  valid_until date,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  check(valid_until is null or valid_until>valid_from),
  check((treatment='taxable' and rate_bps>0) or (treatment in ('exempt','zero_rated') and rate_bps=0 and length(btrim(reason))>=5)),
  unique(workspace_id,item_id,valid_from)
);
create index crm_fiscal_item_taxes_lookup on public.crm_fiscal_item_taxes(workspace_id,item_id,valid_from,valid_until);
create table public.crm_fiscal_series (
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  code text not null check(code ~ '^[A-Z0-9-]{1,20}$'),
  document_type text not null check(document_type in ('F1','F2','R1','R5')),
  last_number bigint not null default 0 check(last_number>=0),
  primary key(workspace_id,code)
);
create table public.crm_fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  request_id uuid not null,
  request_body jsonb not null,
  source_sale_id uuid unique references public.crm_pos_sales(id) on delete restrict,
  series_code text not null,
  sequence_number bigint not null check(sequence_number>0),
  document_number text not null,
  document_type text not null check(document_type in ('F1','F2','R1','R5')),
  issue_date date not null,
  operation_date date not null,
  issued_at timestamptz not null default clock_timestamp(),
  issuer_snapshot jsonb not null,
  customer_snapshot jsonb not null default '{}',
  currency text not null default 'EUR' check(currency='EUR'),
  taxable_base_cents bigint not null,
  tax_cents bigint not null,
  total_cents bigint not null,
  tax_summary jsonb not null,
  correction_of uuid references public.crm_fiscal_documents(id) on delete restrict,
  correction_reason text,
  release_version text not null references public.crm_fiscal_releases(version),
  actor_id uuid not null,
  unique(workspace_id,request_id),
  unique(workspace_id,series_code,sequence_number),
  unique(workspace_id,id),
  foreign key(workspace_id,series_code) references public.crm_fiscal_series(workspace_id,code),
  check(taxable_base_cents+tax_cents=total_cents),
  check((document_type in ('F1','F2') and total_cents>=0 and correction_of is null) or (document_type in ('R1','R5') and total_cents<=0 and correction_of is not null and length(btrim(correction_reason))>=5))
);
create index crm_fiscal_documents_period on public.crm_fiscal_documents(workspace_id,issue_date,id);
create index crm_fiscal_documents_corrections on public.crm_fiscal_documents(correction_of);
create index crm_fiscal_documents_release on public.crm_fiscal_documents(release_version);
create table public.crm_fiscal_document_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  document_id uuid not null,
  line_number integer not null check(line_number>0),
  item_id uuid not null references public.crm_inventory_items(id) on delete restrict,
  sku text not null,
  description text not null,
  unit text not null,
  quantity numeric(16,4) not null check(quantity<>0),
  unit_price_cents bigint not null check(unit_price_cents>=0),
  discount_bps integer not null check(discount_bps between 0 and 10000),
  rate_bps integer not null check(rate_bps in (0,400,1000,2100)),
  treatment text not null check(treatment in ('taxable','zero_rated','exempt')),
  reason text not null default '',
  base_cents bigint not null,
  tax_cents bigint not null,
  total_cents bigint not null,
  original_line_id uuid references public.crm_fiscal_document_lines(id) on delete restrict,
  unique(document_id,line_number),
  foreign key(workspace_id,document_id) references public.crm_fiscal_documents(workspace_id,id) on delete restrict,
  check(base_cents+tax_cents=total_cents)
);
create index crm_fiscal_document_lines_tenant on public.crm_fiscal_document_lines(workspace_id,document_id);
create index crm_fiscal_document_lines_original on public.crm_fiscal_document_lines(original_line_id);
create index crm_fiscal_document_lines_item on public.crm_fiscal_document_lines(item_id);
create table public.crm_fiscal_outbox (
  document_id uuid primary key references public.crm_fiscal_documents(id) on delete restrict,
  workspace_id text not null,
  status text not null default 'awaiting_adapter' check(status in ('awaiting_adapter','pending','submitted','accepted','rejected')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key(workspace_id,document_id) references public.crm_fiscal_documents(workspace_id,id)
);
create index crm_fiscal_outbox_tenant on public.crm_fiscal_outbox(workspace_id,status);
create table public.crm_fiscal_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  actor_id uuid not null,
  event_type text not null,
  entity_id text not null,
  details jsonb not null,
  created_at timestamptz not null default now()
);
create index crm_fiscal_events_tenant on public.crm_fiscal_events(workspace_id,created_at,id);
create table public.crm_fiscal_period_locks (
  workspace_id text not null references public.crm_workspaces(id) on delete restrict,
  through_date date not null,
  actor_id uuid not null,
  locked_at timestamptz not null default now(),
  primary key(workspace_id,through_date)
);

-- Membership, rather than a platform-administrator bypass, is mandatory.
-- Read access survives subscription expiration to preserve accounting access.
create function fiscal_private.allowed(w text,capability text default 'read') returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.crm_workspace_members m where m.workspace_id=w
      and m.profile_id=(select auth.uid()) and m.status='active'
      and ((capability in ('read','export') and (capability='read' or m.role in ('owner','admin','manager'))
          and (m.role in ('owner','admin') or exists(select 1 from public.crm_role_template_tools rt join public.crm_role_templates t on t.id=rt.template_id where rt.template_id=m.role_template_id and t.workspace_id=w and rt.tool_key in ('pos','sales'))))
        or (capability='manage' and m.role in ('owner','admin'))
        or (capability='issue' and m.role in ('owner','admin','manager','staff') and public.crm_has_tool(w,'pos')))
  );
$$;
create function public.crm_fiscal_access(p_workspace text) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('read',fiscal_private.allowed(p_workspace,'read'),'export',fiscal_private.allowed(p_workspace,'export'),'manage',fiscal_private.allowed(p_workspace,'manage'),'issue',fiscal_private.allowed(p_workspace,'issue'));
$$;

create function fiscal_private.reject_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Issued fiscal records are append-only; create a linked correction' using errcode='55000'; end;
$$;
create trigger fiscal_documents_immutable before update or delete on public.crm_fiscal_documents for each row execute function fiscal_private.reject_mutation();
create trigger fiscal_lines_immutable before update or delete on public.crm_fiscal_document_lines for each row execute function fiscal_private.reject_mutation();
create trigger fiscal_events_immutable before update or delete on public.crm_fiscal_events for each row execute function fiscal_private.reject_mutation();
create trigger fiscal_period_locks_immutable before update or delete on public.crm_fiscal_period_locks for each row execute function fiscal_private.reject_mutation();

-- A direct privileged insert must preserve the same accounting identities as RPCs.
create function fiscal_private.check_totals() returns trigger language plpgsql set search_path='' as $$
declare d public.crm_fiscal_documents; sums record; target uuid;
begin
 if tg_table_name='crm_fiscal_documents' then target:=new.id; else target:=new.document_id; end if;
 select * into strict d from public.crm_fiscal_documents where id=target;
 select count(*) n,coalesce(sum(base_cents),0) b,coalesce(sum(tax_cents),0) t,coalesce(sum(total_cents),0) g into sums from public.crm_fiscal_document_lines where document_id=target;
 if sums.n=0 or sums.b<>d.taxable_base_cents or sums.t<>d.tax_cents or sums.g<>d.total_cents then raise exception 'Fiscal document totals do not match immutable lines'; end if;
 if exists(select 1 from public.crm_fiscal_document_lines l where l.document_id=target and ((d.document_type in ('F1','F2') and l.quantity<=0) or (d.document_type in ('R1','R5') and (l.quantity>=0 or l.original_line_id is null)))) then raise exception 'Fiscal line direction is inconsistent'; end if;
 return null;
end;
$$;
create constraint trigger fiscal_header_totals after insert on public.crm_fiscal_documents deferrable initially deferred for each row execute function fiscal_private.check_totals();
create constraint trigger fiscal_line_totals after insert on public.crm_fiscal_document_lines deferrable initially deferred for each row execute function fiscal_private.check_totals();

create function fiscal_private.valid_nif(id text) returns boolean language plpgsql immutable set search_path='' as $$
declare n integer; s integer:=0; d integer; i integer;
begin
 if id ~ '^[0-9]{8}[A-Z]$' then return substr('TRWAGMYFPDXBNJZSQVHLCKE',mod(substr(id,1,8)::bigint,23)::integer+1,1)=right(id,1); end if;
 if id ~ '^[XYZ][0-9]{7}[A-Z]$' then return substr('TRWAGMYFPDXBNJZSQVHLCKE',mod(((strpos('XYZ',left(id,1))-1)::text||substr(id,2,7))::bigint,23)::integer+1,1)=right(id,1); end if;
 if id !~ '^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$' then return false; end if;
 for i in 2..8 loop n:=substr(id,i,1)::integer; if mod(i,2)=0 then n:=n*2; s:=s+n/10+mod(n,10); else s:=s+n; end if; end loop;
 d:=mod(10-mod(s,10),10);
 if left(id,1) in ('A','B','E','H') then return right(id,1)=d::text; end if;
 if left(id,1) in ('N','P','Q','R','S','W') then return right(id,1)=substr('JABCDEFGHI',d+1,1); end if;
 return right(id,1) in (d::text,substr('JABCDEFGHI',d+1,1));
end;
$$;
create function fiscal_private.assert_release(w text) returns public.crm_fiscal_profiles
language plpgsql security definer set search_path='' as $$
declare p public.crm_fiscal_profiles;
begin
 if not fiscal_private.allowed(w,'issue') then raise exception 'Fiscal issuance access required' using errcode='42501'; end if;
 select * into p from public.crm_fiscal_profiles where workspace_id=w for share;
 if not found then raise exception 'Configure the issuer fiscal profile first'; end if;
 if not exists(select 1 from public.crm_fiscal_releases r where r.version=p.release_version and r.status='approved') then
   raise exception 'Fiscal issuance disabled: producer declaration and validated submission adapter are outstanding' using errcode='55000';
 end if;
 -- A settings change cannot enable incomplete billing software. Remove this gate
 -- only in a reviewed migration integrating atomic SIF records, XML/hash chaining,
 -- invoice QR rendering and the operational sale/payment/stock transaction.
 raise exception 'Fiscal issuance disabled: atomic fiscal adapter integration is not installed' using errcode='55000';
 return p;
end;
$$;

create function fiscal_private.save_profile(w text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.crm_fiscal_profiles; old_profile jsonb; nid text:=upper(btrim(p->>'tax_id'));
begin
 if not fiscal_private.allowed(w,'manage') then raise exception 'Fiscal settings require workspace owner or admin' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or not coalesce(fiscal_private.valid_nif(nid),false) then raise exception 'Valid Spanish NIF/NIE required'; end if;
 if coalesce(p->>'country','ES')<>'ES' or coalesce(p->>'jurisdiction','common_territory')<>'common_territory' or coalesce(p->>'currency','EUR')<>'EUR' or coalesce(p->>'tax_regime','general')<>'general' or coalesce((p->>'sii')::boolean,false) then raise exception 'Unsupported fiscal scope'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fiscal-profile:'||w,0));
 select to_jsonb(f) into old_profile from public.crm_fiscal_profiles f where workspace_id=w;
 if old_profile is not null and old_profile->>'tax_id'<>nid and exists(select 1 from public.crm_fiscal_documents where workspace_id=w) then raise exception 'An issuer with issued documents cannot change NIF; create a separate legal workspace'; end if;
 insert into public.crm_fiscal_profiles(workspace_id,legal_name,tax_id,address,postal_code,city,simplified_limit_cents,eligible_activity,updated_by)
 values(w,btrim(p->>'legal_name'),nid,btrim(p->>'address'),btrim(p->>'postal_code'),btrim(p->>'city'),coalesce((p->>'simplified_limit_cents')::integer,40000),btrim(coalesce(p->>'eligible_activity','')),(select auth.uid()))
 on conflict(workspace_id) do update set legal_name=excluded.legal_name,tax_id=excluded.tax_id,address=excluded.address,postal_code=excluded.postal_code,city=excluded.city,simplified_limit_cents=excluded.simplified_limit_cents,eligible_activity=excluded.eligible_activity,updated_by=excluded.updated_by,updated_at=now()
 returning * into result;
 insert into public.crm_fiscal_events(workspace_id,actor_id,event_type,entity_id,details) values(w,(select auth.uid()),'profile_saved',w,jsonb_build_object('before',old_profile,'after',to_jsonb(result)));
 return to_jsonb(result);
end;
$$;
create function public.crm_fiscal_save_profile(p_workspace text,p_profile jsonb) returns jsonb language sql set search_path='' as $$select fiscal_private.save_profile(p_workspace,p_profile)$$;

create function fiscal_private.assign_tax(w text,item uuid,rate integer,treatment text,reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare day date; row public.crm_fiscal_item_taxes;
begin
 if not fiscal_private.allowed(w,'manage') then raise exception 'Fiscal settings require workspace owner or admin' using errcode='42501'; end if;
 if not exists(select 1 from public.crm_inventory_items where id=item and workspace_id=w) then raise exception 'Product not found in workspace'; end if;
 select (clock_timestamp() at time zone coalesce(timezone,'Europe/Madrid'))::date into day from public.crm_workspaces where id=w;
 perform pg_advisory_xact_lock(hashtextextended('fiscal-tax:'||w||':'||item::text,0));
 -- Changes become effective today. Issued documents retain their original tax snapshot.
 update public.crm_fiscal_item_taxes set valid_until=day where workspace_id=w and item_id=item and valid_until is null and valid_from<day;
 insert into public.crm_fiscal_item_taxes(workspace_id,item_id,rate_bps,treatment,reason,valid_from,created_by) values(w,item,rate,treatment,btrim(reason),day,(select auth.uid()))
 on conflict(workspace_id,item_id,valid_from) do update set rate_bps=excluded.rate_bps,treatment=excluded.treatment,reason=excluded.reason
 returning * into row;
 insert into public.crm_fiscal_events(workspace_id,actor_id,event_type,entity_id,details) values(w,(select auth.uid()),'tax_assigned',item::text,to_jsonb(row));
 return to_jsonb(row);
end;
$$;
create function public.crm_fiscal_assign_tax(p_workspace text,p_item uuid,p_rate_bps integer,p_treatment text default 'taxable',p_reason text default '') returns jsonb language sql set search_path='' as $$select fiscal_private.assign_tax(p_workspace,p_item,p_rate_bps,p_treatment,p_reason)$$;

create function fiscal_private.issue(w text,request uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.crm_fiscal_profiles; existing public.crm_fiscal_documents; doc_id uuid:=gen_random_uuid();
 day date; doc_type text:=body->>'document_type'; v_series_code text; num bigint; customer jsonb:=coalesce(body->'customer','{}');
 line jsonb; product public.crm_inventory_items; tax public.crm_fiscal_item_taxes; qty numeric; discount integer; gross bigint; base bigint;
 total bigint:=0; basis bigint:=0; vat bigint:=0; rows jsonb:='[]'; summary jsonb; idx integer:=0; sale public.crm_pos_sales; source_id uuid;
begin
 if not fiscal_private.allowed(w,'issue') then raise exception 'Fiscal issuance access required' using errcode='42501'; end if;
 if request is null or jsonb_typeof(body) is distinct from 'object' then raise exception 'Request ID and document object required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fiscal-issue:'||w,0));
 select * into existing from public.crm_fiscal_documents where workspace_id=w and request_id=request;
 if found then if existing.request_body<>body then raise exception 'Idempotency key reused with a different request' using errcode='23505'; end if; return to_jsonb(existing); end if;
 p:=fiscal_private.assert_release(w);
 select (clock_timestamp() at time zone coalesce(timezone,'Europe/Madrid'))::date into day from public.crm_workspaces where id=w;
 if exists(select 1 from public.crm_fiscal_period_locks where workspace_id=w and through_date>=day) then raise exception 'Accounting period is locked'; end if;
 if doc_type is null or doc_type not in ('F1','F2') then raise exception 'Only F1/F2 issuance is supported; use the correction operation for returns'; end if;
 if coalesce(body->>'operation_date',day::text)<>day::text then raise exception 'This release supports same-day operations only'; end if;
 if doc_type='F1' and (jsonb_typeof(customer) is distinct from 'object' or length(btrim(coalesce(customer->>'legal_name','')))<2 or not coalesce(fiscal_private.valid_nif(upper(customer->>'tax_id')),false) or length(btrim(coalesce(customer->>'address','')))<3 or coalesce(customer->>'country','')<>'ES') then raise exception 'Full invoices require Spanish customer name, valid NIF and fiscal address'; end if;
 if doc_type='F2' and customer<>'{}'::jsonb then raise exception 'Use F1 when customer fiscal details are needed'; end if;
 if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 200 then raise exception 'Between 1 and 200 product lines required'; end if;
 if (select count(distinct l->>'item_id') from jsonb_array_elements(body->'lines') l)<>jsonb_array_length(body->'lines') then raise exception 'Duplicate product lines are not supported; consolidate quantities'; end if;
 for line in select * from jsonb_array_elements(body->'lines') loop
   if coalesce(line->>'quantity','') !~ '^(0|[1-9][0-9]{0,5})(\.[0-9]{1,4})?$' then raise exception 'Invalid quantity or precision'; end if;
   qty:=(line->>'quantity')::numeric; discount:=coalesce((line->>'discount_bps')::integer,0);
   if qty<=0 or discount not between 0 and 10000 then raise exception 'Invalid quantity or discount'; end if;
   if discount>0 and not fiscal_private.allowed(w,'manage') then raise exception 'Discounts require fiscal manager access' using errcode='42501'; end if;
   select * into product from public.crm_inventory_items where workspace_id=w and id=(line->>'item_id')::uuid and active for share;
   if not found or product.sale_price_cents is null or product.sale_price_cents<0 then raise exception 'Active product with configured selling price required'; end if;
   select * into tax from public.crm_fiscal_item_taxes where workspace_id=w and item_id=product.id and valid_from<=day and (valid_until is null or valid_until>day);
   if not found then raise exception 'Product IVA treatment must be configured before issuance'; end if;
   if tax.treatment<>'taxable' then raise exception 'Zero-rated and exempt issuance requires a reviewed legal exemption-v_series_code adapter'; end if;
   gross:=round(qty*product.sale_price_cents*(10000-discount)/10000); base:=round(gross::numeric*10000/(10000+tax.rate_bps));
   total:=total+gross; basis:=basis+base; vat:=vat+gross-base; idx:=idx+1;
   if total>2000000000 then raise exception 'Document exceeds supported amount'; end if;
   rows:=rows||jsonb_build_array(jsonb_build_object('line_number',idx,'item_id',product.id,'sku',coalesce(product.sku,''),'description',product.name,'unit',coalesce(product.unit,'unit'),'quantity',qty,'unit_price_cents',product.sale_price_cents,'discount_bps',discount,'rate_bps',tax.rate_bps,'treatment',tax.treatment,'reason',tax.reason,'base_cents',base,'tax_cents',gross-base,'total_cents',gross));
 end loop;
 if doc_type='F2' and total>p.simplified_limit_cents then raise exception 'Simplified-invoice amount exceeds the configured permitted activity limit; use F1'; end if;
 if body ? 'expected_total_cents' and (body->>'expected_total_cents')::bigint<>total then raise exception 'Prices changed or submitted total is inconsistent; refresh and retry'; end if;
 source_id:=nullif(body->>'source_sale_id','')::uuid;
 if source_id is not null then raise exception 'Operational sales require the atomic fiscal checkout adapter; historical tax must not be inferred'; end if;

 select jsonb_agg(to_jsonb(g) order by rate_bps,treatment,reason) into summary from (select rate_bps,treatment,reason,sum(base_cents)::bigint base_cents,sum(tax_cents)::bigint tax_cents,sum(total_cents)::bigint total_cents from jsonb_to_recordset(rows) r(rate_bps integer,treatment text,reason text,base_cents bigint,tax_cents bigint,total_cents bigint) group by rate_bps,treatment,reason) g;
 v_series_code:=doc_type||'-'||extract(year from day)::text;
 insert into public.crm_fiscal_series(workspace_id,code,document_type) values(w,v_series_code,doc_type) on conflict do nothing;
 update public.crm_fiscal_series set last_number=last_number+1 where workspace_id=w and crm_fiscal_series.code=v_series_code and document_type=doc_type returning last_number into num;
 if num is null then raise exception 'Invalid fiscal series'; end if;
 insert into public.crm_fiscal_documents(id,workspace_id,request_id,request_body,source_sale_id,series_code,sequence_number,document_number,document_type,issue_date,operation_date,issuer_snapshot,customer_snapshot,taxable_base_cents,tax_cents,total_cents,tax_summary,release_version,actor_id)
 values(doc_id,w,request,body,source_id,v_series_code,num,v_series_code||'-'||lpad(num::text,8,'0'),doc_type,day,day,to_jsonb(p)-'updated_by'-'updated_at',customer,basis,vat,total,summary,p.release_version,(select auth.uid()));
 insert into public.crm_fiscal_document_lines(workspace_id,document_id,line_number,item_id,sku,description,unit,quantity,unit_price_cents,discount_bps,rate_bps,treatment,reason,base_cents,tax_cents,total_cents)
 select w,doc_id,r.* from jsonb_to_recordset(rows) r(line_number integer,item_id uuid,sku text,description text,unit text,quantity numeric,unit_price_cents bigint,discount_bps integer,rate_bps integer,treatment text,reason text,base_cents bigint,tax_cents bigint,total_cents bigint);
 insert into public.crm_fiscal_outbox(document_id,workspace_id) values(doc_id,w);
 insert into public.crm_fiscal_events(workspace_id,actor_id,event_type,entity_id,details) values(w,(select auth.uid()),'document_issued',doc_id::text,jsonb_build_object('number',v_series_code||'-'||lpad(num::text,8,'0')));
 return (select to_jsonb(d) from public.crm_fiscal_documents d where id=doc_id);
end;
$$;
create function public.crm_fiscal_issue_document(p_workspace text,p_request_id uuid,p_document jsonb) returns jsonb language sql set search_path='' as $$select fiscal_private.issue(p_workspace,p_request_id,p_document)$$;

create function fiscal_private.reverse(w text,request uuid,original uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.crm_fiscal_profiles; source public.crm_fiscal_documents; existing public.crm_fiscal_documents; doc_id uuid:=gen_random_uuid(); row public.crm_fiscal_document_lines;
 line jsonb; qty numeric; already numeric; base bigint; gross bigint; total bigint:=0; basis bigint:=0; vat bigint:=0; idx integer:=0; rows jsonb:='[]'; summary jsonb; day date; v_series_code text; num bigint; kind text; request_body jsonb:=jsonb_build_object('original',original,'return',body);
begin
 if not fiscal_private.allowed(w,'manage') then raise exception 'Corrections require fiscal manager access' using errcode='42501'; end if;
 if request is null or original is null or jsonb_typeof(body) is distinct from 'object' then raise exception 'Request ID, original document and return required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fiscal-issue:'||w,0));
 select * into existing from public.crm_fiscal_documents where workspace_id=w and request_id=request;
 if found then if existing.request_body<>request_body then raise exception 'Idempotency key reused with a different request' using errcode='23505'; end if; return to_jsonb(existing); end if;
 p:=fiscal_private.assert_release(w);
 select * into source from public.crm_fiscal_documents where workspace_id=w and id=original for share;
 if not found or source.document_type not in ('F1','F2') then raise exception 'Original invoice not found'; end if;
 if length(btrim(coalesce(body->>'reason','')))<5 then raise exception 'Correction reason required'; end if;
 if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 200 then raise exception 'Return lines required'; end if;
 if (select count(distinct l->>'line_id') from jsonb_array_elements(body->'lines') l)<>jsonb_array_length(body->'lines') then raise exception 'Duplicate return lines'; end if;
 select (clock_timestamp() at time zone coalesce(timezone,'Europe/Madrid'))::date into day from public.crm_workspaces where id=w;
 if exists(select 1 from public.crm_fiscal_period_locks where workspace_id=w and through_date>=day) then raise exception 'Accounting period is locked'; end if;
 for line in select * from jsonb_array_elements(body->'lines') loop
  select * into row from public.crm_fiscal_document_lines where document_id=original and workspace_id=w and id=(line->>'line_id')::uuid;
  if not found then raise exception 'Original line not found'; end if;
  if coalesce(line->>'quantity','') !~ '^(0|[1-9][0-9]{0,5})(\.[0-9]{1,4})?$' then raise exception 'Invalid return quantity'; end if;
  qty:=(line->>'quantity')::numeric;
  select coalesce(-sum(quantity),0) into already from public.crm_fiscal_document_lines where original_line_id=row.id;
  if qty<=0 or qty+already>row.quantity then raise exception 'Return exceeds original quantity'; end if;
  -- Cumulative allocation returns every original cent exactly, including the last fragment.
  gross:=round(row.total_cents*(already+qty)/row.quantity)-round(row.total_cents*already/row.quantity);
  -- Allocate the rounded gross first, then its original base share. This avoids
  -- a zero-cent refund carrying a positive base and negative IVA on tiny returns.
  base:=case when row.total_cents=0 then 0 else round(row.base_cents*round(row.total_cents*(already+qty)/row.quantity)/row.total_cents)-round(row.base_cents*round(row.total_cents*already/row.quantity)/row.total_cents) end;
  total:=total-gross; basis:=basis-base; vat:=vat-(gross-base); idx:=idx+1;
  rows:=rows||jsonb_build_array(jsonb_build_object('line_number',idx,'item_id',row.item_id,'sku',row.sku,'description',row.description,'unit',row.unit,'quantity',-qty,'unit_price_cents',row.unit_price_cents,'discount_bps',row.discount_bps,'rate_bps',row.rate_bps,'treatment',row.treatment,'reason',row.reason,'base_cents',-base,'tax_cents',-(gross-base),'total_cents',-gross,'original_line_id',row.id));
 end loop;
 select jsonb_agg(to_jsonb(g) order by rate_bps,treatment,reason) into summary from (select rate_bps,treatment,reason,sum(base_cents)::bigint base_cents,sum(tax_cents)::bigint tax_cents,sum(total_cents)::bigint total_cents from jsonb_to_recordset(rows) r(rate_bps integer,treatment text,reason text,base_cents bigint,tax_cents bigint,total_cents bigint) group by rate_bps,treatment,reason) g;
 kind:=case when source.document_type='F2' then 'R5' else 'R1' end; v_series_code:=kind||'-'||extract(year from day)::text;
 insert into public.crm_fiscal_series(workspace_id,code,document_type) values(w,v_series_code,kind) on conflict do nothing;
 update public.crm_fiscal_series set last_number=last_number+1 where workspace_id=w and crm_fiscal_series.code=v_series_code and document_type=kind returning last_number into num;
 if num is null then raise exception 'Invalid corrective series'; end if;
 insert into public.crm_fiscal_documents(id,workspace_id,request_id,request_body,series_code,sequence_number,document_number,document_type,issue_date,operation_date,issuer_snapshot,customer_snapshot,taxable_base_cents,tax_cents,total_cents,tax_summary,correction_of,correction_reason,release_version,actor_id)
 values(doc_id,w,request,request_body,v_series_code,num,v_series_code||'-'||lpad(num::text,8,'0'),kind,day,day,to_jsonb(p)-'updated_by'-'updated_at',source.customer_snapshot,basis,vat,total,summary,original,btrim(body->>'reason'),p.release_version,(select auth.uid()));
 insert into public.crm_fiscal_document_lines(workspace_id,document_id,line_number,item_id,sku,description,unit,quantity,unit_price_cents,discount_bps,rate_bps,treatment,reason,base_cents,tax_cents,total_cents,original_line_id)
 select w,doc_id,r.* from jsonb_to_recordset(rows) r(line_number integer,item_id uuid,sku text,description text,unit text,quantity numeric,unit_price_cents bigint,discount_bps integer,rate_bps integer,treatment text,reason text,base_cents bigint,tax_cents bigint,total_cents bigint,original_line_id uuid);
 insert into public.crm_fiscal_outbox(document_id,workspace_id) values(doc_id,w);
 insert into public.crm_fiscal_events(workspace_id,actor_id,event_type,entity_id,details) values(w,(select auth.uid()),'correction_issued',doc_id::text,jsonb_build_object('original',original,'reason',body->>'reason'));
 return (select to_jsonb(d) from public.crm_fiscal_documents d where id=doc_id);
end;
$$;
create function public.crm_fiscal_reverse_document(p_workspace text,p_request_id uuid,p_original uuid,p_return jsonb) returns jsonb language sql set search_path='' as $$select fiscal_private.reverse(p_workspace,p_request_id,p_original,p_return)$$;

create function fiscal_private.lock_period(w text,through date) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not fiscal_private.allowed(w,'manage') then raise exception 'Accounting period locking requires owner/admin' using errcode='42501'; end if;
 if through is null or through>=current_date then raise exception 'Only completed past dates may be locked'; end if;
 insert into public.crm_fiscal_period_locks(workspace_id,through_date,actor_id) values(w,through,(select auth.uid())) on conflict do nothing;
 return jsonb_build_object('through_date',through);
end;
$$;
create function public.crm_fiscal_lock_period(p_workspace text,p_through date) returns jsonb language sql set search_path='' as $$select fiscal_private.lock_period(p_workspace,p_through)$$;

-- Paginated, stable immutable ledger. The captured export time excludes later records.
create function fiscal_private.export_ledger(w text,from_day date,through_day date,as_of timestamptz,after_id uuid,page_size integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not fiscal_private.allowed(w,'export') then raise exception 'Fiscal export access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fiscal-issue:'||w,0));
 as_of:=coalesce(as_of,clock_timestamp());
 if from_day is null or through_day is null or through_day<from_day or as_of>clock_timestamp() or page_size not between 1 and 500 then raise exception 'Invalid ledger range'; end if;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') into result from (
   select f.*, (select coalesce(jsonb_agg(to_jsonb(l) order by l.line_number),'[]') from public.crm_fiscal_document_lines l where l.document_id=f.id) lines
   from public.crm_fiscal_documents f where f.workspace_id=w and f.issue_date between from_day and through_day and f.issued_at<=as_of and (after_id is null or f.id>after_id) order by f.id limit page_size
 ) d;
 return jsonb_build_object('documents',result,'as_of',as_of,'format','akihq-issued-ledger-v1','official_aeat_book',false);
end;
$$;
create function public.crm_fiscal_export_ledger(p_workspace text,p_from date,p_through date,p_as_of timestamptz,p_after uuid default null,p_limit integer default 250) returns jsonb language sql set search_path='' as $$select fiscal_private.export_ledger(p_workspace,p_from,p_through,p_as_of,p_after,p_limit)$$;

create function public.crm_fiscal_overview(p_workspace text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('access',public.crm_fiscal_access(p_workspace),
 'profile',(select to_jsonb(p) from public.crm_fiscal_profiles p where workspace_id=p_workspace),
 'release',(select to_jsonb(r)||jsonb_build_object('atomic_adapter_ready',false) from public.crm_fiscal_releases r where version=coalesce((select release_version from public.crm_fiscal_profiles where workspace_id=p_workspace),'akihq-fiscal-0.1')),
 'tax_assignments',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.crm_fiscal_item_taxes t where workspace_id=p_workspace and valid_until is null),
 'series',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.crm_fiscal_series s where workspace_id=p_workspace),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from (select id,document_number,document_type,issue_date,total_cents,currency from public.crm_fiscal_documents where workspace_id=p_workspace order by issued_at desc,id limit 50) d));
$$;

-- Explicit privileges: new tables cannot inherit permissive project defaults.
do $$ declare t text; begin
 foreach t in array array['crm_fiscal_profiles','crm_fiscal_item_taxes','crm_fiscal_series','crm_fiscal_documents','crm_fiscal_document_lines','crm_fiscal_outbox','crm_fiscal_events','crm_fiscal_period_locks'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
  execute format('create policy tenant_fiscal_read on public.%I for select to authenticated using(fiscal_private.allowed(workspace_id,''read''))',t);
 end loop;
end $$;
alter table public.crm_fiscal_releases enable row level security;
revoke all on public.crm_fiscal_releases from public,anon,authenticated;
grant select on public.crm_fiscal_releases to authenticated;
grant select,insert,update on public.crm_fiscal_releases to service_role;
create policy fiscal_release_read on public.crm_fiscal_releases for select to authenticated using(true);
revoke all on all functions in schema fiscal_private from public,anon,authenticated;
grant execute on function fiscal_private.allowed(text,text),fiscal_private.save_profile(text,jsonb),fiscal_private.assign_tax(text,uuid,integer,text,text),fiscal_private.issue(text,uuid,jsonb),fiscal_private.reverse(text,uuid,uuid,jsonb),fiscal_private.lock_period(text,date),fiscal_private.export_ledger(text,date,date,timestamptz,uuid,integer) to authenticated;
revoke all on function public.crm_fiscal_access(text),public.crm_fiscal_save_profile(text,jsonb),public.crm_fiscal_assign_tax(text,uuid,integer,text,text),public.crm_fiscal_issue_document(text,uuid,jsonb),public.crm_fiscal_reverse_document(text,uuid,uuid,jsonb),public.crm_fiscal_lock_period(text,date),public.crm_fiscal_export_ledger(text,date,date,timestamptz,uuid,integer),public.crm_fiscal_overview(text) from public,anon;
grant execute on function public.crm_fiscal_access(text),public.crm_fiscal_save_profile(text,jsonb),public.crm_fiscal_assign_tax(text,uuid,integer,text,text),public.crm_fiscal_issue_document(text,uuid,jsonb),public.crm_fiscal_reverse_document(text,uuid,uuid,jsonb),public.crm_fiscal_lock_period(text,date),public.crm_fiscal_export_ledger(text,date,date,timestamptz,uuid,integer),public.crm_fiscal_overview(text) to authenticated;
commit;
