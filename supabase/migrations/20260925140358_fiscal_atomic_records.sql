-- Atomic SIF registration records. Does NOT remove assert_release or authorize
-- production invoicing: certificate/representation and release acceptance remain required.
begin;
-- Numbering must not restart when the same issuer has another workspace.
create unique index fiscal_document_issuer_number on public.crm_fiscal_documents((issuer_snapshot->>'tax_id'),document_number);
create table fiscal_private.issuer_sequences(issuer_nif text not null,series_code text not null,last_number bigint not null check(last_number between 1 and 99999999),primary key(issuer_nif,series_code));
alter table fiscal_private.issuer_sequences enable row level security;
revoke all on fiscal_private.issuer_sequences from public,anon,authenticated,service_role;
insert into fiscal_private.issuer_sequences select issuer_snapshot->>'tax_id',series_code,max(sequence_number) from public.crm_fiscal_documents group by issuer_snapshot->>'tax_id',series_code;
create function fiscal_private.next_number(nif text,code text) returns bigint language plpgsql set search_path='' as $$
declare n bigint;
begin
 insert into fiscal_private.issuer_sequences(issuer_nif,series_code,last_number) values(nif,code,1)
 on conflict(issuer_nif,series_code) do update set last_number=fiscal_private.issuer_sequences.last_number+1 returning last_number into n;
 return n;
end $$;
revoke all on function fiscal_private.next_number(text,text) from public,anon,authenticated,service_role;
create table fiscal_private.installations (
 workspace_id text primary key references public.crm_workspaces(id),
 environment text not null check(environment in ('test','production')),
 system jsonb not null,
 description text not null default 'Venta de bienes y servicios',
 created_at timestamptz not null default now()
);
create table fiscal_private.chain_heads (
 issuer_nif text not null,installation text not null,environment text not null,
 document_id uuid not null references public.crm_fiscal_documents(id),hash text not null,
 primary key(issuer_nif,installation,environment)
);
create table fiscal_private.registrations (
 document_id uuid primary key references public.crm_fiscal_documents(id),workspace_id text not null,
 environment text not null,context jsonb not null,hash_input text not null,hash text not null,
 previous_document_id uuid references public.crm_fiscal_documents(id),xml text not null,qr_url text not null,
 generated_at text not null,created_at timestamptz not null default now()
);
alter table fiscal_private.installations enable row level security;
alter table fiscal_private.chain_heads enable row level security;
alter table fiscal_private.registrations enable row level security;
revoke all on fiscal_private.installations,fiscal_private.chain_heads,fiscal_private.registrations from public,anon,authenticated,service_role;
create trigger fiscal_registration_immutable before update or delete on fiscal_private.registrations for each row execute function fiscal_private.reject_mutation();
create function fiscal_private.xml_text(v text) returns text language plpgsql immutable set search_path='' as $$
begin
 if v is null or v ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' then raise exception 'Invalid XML value'; end if;
 return replace(replace(replace(replace(replace(v,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&apos;');
end $$;
create function fiscal_private.tag(n text,v text) returns text language sql immutable set search_path='' as $$select '<sf:'||n||'>'||fiscal_private.xml_text(v)||'</sf:'||n||'>'$$;
create function fiscal_private.block(n text,v text) returns text language sql immutable set search_path='' as $$select '<sf:'||n||'>'||v||'</sf:'||n||'>'$$;
create function fiscal_private.amount(c bigint) returns text language sql immutable set search_path='' as $$select case when c<0 then '-' else '' end||(abs(c)/100)::text||'.'||lpad(mod(abs(c),100)::text,2,'0')$$;
create function fiscal_private.record_identity(nif text,number text,day date) returns text language sql immutable set search_path='' as $$select fiscal_private.tag('IDEmisorFactura',nif)||fiscal_private.tag('NumSerieFactura',number)||fiscal_private.tag('FechaExpedicionFactura',to_char(day,'DD-MM-YYYY'))$$;
create function fiscal_private.capture_registration() returns trigger language plpgsql security definer set search_path='' as $$
declare
 d public.crm_fiscal_documents; original public.crm_fiscal_documents; previous public.crm_fiscal_documents;
 config fiscal_private.installations; head fiscal_private.chain_heads; sys jsonb; row jsonb;
 nif text; v_installation text; stamp text; hash_input text; hash text; chain text; system_xml text; tax_xml text:='';
 recipient text:=''; correction text:=''; registration text; payload text; qr text; context jsonb;
 basis bigint:=0; tax bigint:=0; total bigint:=0;
begin
 if auth.uid() is null then raise exception 'Authenticated fiscal issuer required' using errcode='42501'; end if;
 select * into strict d from public.crm_fiscal_documents where id=new.document_id and workspace_id=new.workspace_id;
 if not fiscal_private.allowed(d.workspace_id,'issue') then raise exception 'Fiscal issuance access required' using errcode='42501'; end if;
 select * into config from fiscal_private.installations where workspace_id=d.workspace_id;
 if not found then raise exception 'Verified fiscal installation configuration required'; end if;
 sys:=config.system;nif:=d.issuer_snapshot->>'tax_id';v_installation:=sys->>'installation';
 if d.currency<>'EUR' or d.issuer_snapshot->>'country'<>'ES' or d.issuer_snapshot->>'jurisdiction'<>'common_territory' then raise exception 'Unsupported fiscal scope'; end if;
 if sys->>'version' is distinct from d.release_version or sys->'verifactu_only' is distinct from 'true'::jsonb
 or jsonb_typeof(sys->'multi_taxpayer') is distinct from 'boolean' or jsonb_typeof(sys->'has_multiple_taxpayers') is distinct from 'boolean'
 or (sys->>'has_multiple_taxpayers')::boolean and not (sys->>'multi_taxpayer')::boolean
 or length(coalesce(sys->>'producer_name','')) not between 2 and 120 or not coalesce(fiscal_private.valid_nif(sys->>'producer_nif'),false)
 or length(coalesce(sys->>'name','')) not between 1 and 30 or length(coalesce(sys->>'id','')) not between 1 and 2
 or length(coalesce(sys->>'version','')) not between 1 and 50 or length(coalesce(v_installation,'')) not between 1 and 100
 or length(btrim(config.description)) not between 1 and 500 then raise exception 'Complete validated producer and installation metadata required'; end if;
 -- Across series and workspaces sharing this issuer/installation. No client chain head.
 perform pg_advisory_xact_lock(hashtextextended('fiscal-chain:'||jsonb_build_array(nif,v_installation,config.environment)::text,0));
 select * into head from fiscal_private.chain_heads where issuer_nif=nif and chain_heads.installation=v_installation and environment=config.environment for update;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
 if head.document_id is null then chain:=fiscal_private.block('Encadenamiento',fiscal_private.tag('PrimerRegistro','S'));
 else
  select * into strict previous from public.crm_fiscal_documents where id=head.document_id;
  chain:=fiscal_private.block('Encadenamiento',fiscal_private.block('RegistroAnterior',fiscal_private.record_identity(nif,previous.document_number,previous.issue_date)||fiscal_private.tag('Huella',head.hash)));
 end if;
 for row in select value from jsonb_array_elements(d.tax_summary) loop
  if row->>'treatment'<>'taxable' or (row->>'rate_bps')::integer not in (400,1000,2100) then raise exception 'Unsupported IVA treatment'; end if;
  basis:=basis+(row->>'base_cents')::bigint;tax:=tax+(row->>'tax_cents')::bigint;total:=total+(row->>'total_cents')::bigint;
  if (row->>'base_cents')::bigint+(row->>'tax_cents')::bigint<>(row->>'total_cents')::bigint then raise exception 'IVA breakdown mismatch'; end if;
  tax_xml:=tax_xml||fiscal_private.block('DetalleDesglose',fiscal_private.tag('Impuesto','01')||fiscal_private.tag('ClaveRegimen','01')||fiscal_private.tag('CalificacionOperacion','S1')||fiscal_private.tag('TipoImpositivo',fiscal_private.amount((row->>'rate_bps')::bigint))||fiscal_private.tag('BaseImponibleOimporteNoSujeto',fiscal_private.amount((row->>'base_cents')::bigint))||fiscal_private.tag('CuotaRepercutida',fiscal_private.amount((row->>'tax_cents')::bigint)));
 end loop;
 if basis<>d.taxable_base_cents or tax<>d.tax_cents or total<>d.total_cents or tax_xml='' then raise exception 'Fiscal totals mismatch'; end if;
 if d.document_type in ('F1','R1') then
  if d.customer_snapshot->>'country'<>'ES' or not coalesce(fiscal_private.valid_nif(d.customer_snapshot->>'tax_id'),false) or length(coalesce(d.customer_snapshot->>'legal_name','')) not between 2 and 120 then raise exception 'Domestic recipient details required'; end if;
  recipient:=fiscal_private.block('Destinatarios',fiscal_private.block('IDDestinatario',fiscal_private.tag('NombreRazon',d.customer_snapshot->>'legal_name')||fiscal_private.tag('NIF',d.customer_snapshot->>'tax_id')));
 elsif d.customer_snapshot<>'{}' then raise exception 'Identified recipients require F1/R1'; end if;
 if d.correction_of is not null then
  select * into strict original from public.crm_fiscal_documents where id=d.correction_of;
  if original.issuer_snapshot->>'tax_id'<>nif then raise exception 'Correction issuer mismatch'; end if;
  correction:=fiscal_private.tag('TipoRectificativa','I')||fiscal_private.block('FacturasRectificadas',fiscal_private.block('IDFacturaRectificada',fiscal_private.record_identity(nif,original.document_number,original.issue_date)));
 end if;
 hash_input:='IDEmisorFactura='||nif||'&NumSerieFactura='||d.document_number||'&FechaExpedicionFactura='||to_char(d.issue_date,'DD-MM-YYYY')||'&TipoFactura='||d.document_type||'&CuotaTotal='||fiscal_private.amount(d.tax_cents)||'&ImporteTotal='||fiscal_private.amount(d.total_cents)||'&Huella='||coalesce(head.hash,'')||'&FechaHoraHusoGenRegistro='||stamp;
 hash:=upper(encode(sha256(convert_to(hash_input,'UTF8')),'hex'));
 system_xml:=fiscal_private.block('SistemaInformatico',fiscal_private.tag('NombreRazon',sys->>'producer_name')||fiscal_private.tag('NIF',sys->>'producer_nif')||fiscal_private.tag('NombreSistemaInformatico',sys->>'name')||fiscal_private.tag('IdSistemaInformatico',sys->>'id')||fiscal_private.tag('Version',sys->>'version')||fiscal_private.tag('NumeroInstalacion',v_installation)||fiscal_private.tag('TipoUsoPosibleSoloVerifactu','S')||fiscal_private.tag('TipoUsoPosibleMultiOT',case when (sys->>'multi_taxpayer')::boolean then 'S' else 'N' end)||fiscal_private.tag('IndicadorMultiplesOT',case when (sys->>'has_multiple_taxpayers')::boolean then 'S' else 'N' end));
 registration:=fiscal_private.block('RegistroAlta',fiscal_private.tag('IDVersion','1.0')||fiscal_private.block('IDFactura',fiscal_private.record_identity(nif,d.document_number,d.issue_date))||fiscal_private.tag('NombreRazonEmisor',d.issuer_snapshot->>'legal_name')||fiscal_private.tag('TipoFactura',d.document_type)||correction||case when d.operation_date<>d.issue_date then fiscal_private.tag('FechaOperacion',to_char(d.operation_date,'DD-MM-YYYY')) else '' end||fiscal_private.tag('DescripcionOperacion',btrim(config.description))||recipient||fiscal_private.block('Desglose',tax_xml)||fiscal_private.tag('CuotaTotal',fiscal_private.amount(d.tax_cents))||fiscal_private.tag('ImporteTotal',fiscal_private.amount(d.total_cents))||chain||system_xml||fiscal_private.tag('FechaHoraHusoGenRegistro',stamp)||fiscal_private.tag('TipoHuella','01')||fiscal_private.tag('Huella',hash));
 payload:='<sfLR:RegFactuSistemaFacturacion xmlns:sfLR="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd" xmlns:sf="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd"><sfLR:Cabecera>'||fiscal_private.block('ObligadoEmision',fiscal_private.tag('NombreRazon',d.issuer_snapshot->>'legal_name')||fiscal_private.tag('NIF',nif))||'</sfLR:Cabecera><sfLR:RegistroFactura>'||registration||'</sfLR:RegistroFactura></sfLR:RegFactuSistemaFacturacion>';
 qr:=case when config.environment='test' then 'https://prewww2.aeat.es' else 'https://www2.agenciatributaria.gob.es' end||'/wlpl/TIKE-CONT/ValidarQR?nif='||nif||'&numserie='||d.document_number||'&fecha='||to_char(d.issue_date,'DD-MM-YYYY')||'&importe='||fiscal_private.amount(d.total_cents);
 context:=jsonb_build_object('system',sys,'environment',config.environment,'description',btrim(config.description),'generated_at',stamp,'previous',case when head.document_id is null then null else jsonb_build_object('issuer_nif',nif,'document_number',previous.document_number,'issue_date',previous.issue_date,'hash',head.hash) end);
 if original.id is not null then context:=context||jsonb_build_object('correction',jsonb_build_object('id',original.id,'issuer_nif',nif,'document_number',original.document_number,'issue_date',original.issue_date));end if;
 insert into fiscal_private.registrations(document_id,workspace_id,environment,context,hash_input,hash,previous_document_id,xml,qr_url,generated_at) values(d.id,d.workspace_id,config.environment,context,hash_input,hash,head.document_id,payload,qr,stamp);
 insert into fiscal_private.chain_heads(issuer_nif,installation,environment,document_id,hash) values(nif,v_installation,config.environment,d.id,hash)
 on conflict(issuer_nif,installation,environment) do update set document_id=excluded.document_id,hash=excluded.hash;
 new.status:='pending';return new;
end $$;
create trigger fiscal_outbox_capture before insert on public.crm_fiscal_outbox for each row execute function fiscal_private.capture_registration();
revoke all on function fiscal_private.xml_text(text),fiscal_private.tag(text,text),fiscal_private.block(text,text),fiscal_private.amount(bigint),fiscal_private.record_identity(text,text,date),fiscal_private.capture_registration() from public,anon,authenticated,service_role;

create table fiscal_private.checkout_authorizations(workspace_id text not null,request_id uuid not null,sale_id uuid not null,actor uuid not null,primary key(workspace_id,request_id));
create table fiscal_private.checkout_payments(workspace_id text not null,request_id uuid not null,request_body jsonb not null,sale_id uuid not null references public.crm_pos_sales(id),document_id uuid not null references public.crm_fiscal_documents(id),method text not null,amount_cents bigint not null,reference text,actor uuid not null,created_at timestamptz not null default now(),primary key(workspace_id,request_id));
alter table fiscal_private.checkout_authorizations enable row level security;
alter table fiscal_private.checkout_payments enable row level security;
revoke all on fiscal_private.checkout_authorizations,fiscal_private.checkout_payments from public,anon,authenticated,service_role;
create trigger fiscal_checkout_payment_immutable before update or delete on fiscal_private.checkout_payments for each row execute function fiscal_private.reject_mutation();
create or replace function fiscal_private.issue(w text,request uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if source_id is not null and not exists(select 1 from fiscal_private.checkout_authorizations a where a.workspace_id=w and a.request_id=request and a.sale_id=source_id and a.actor=auth.uid()) then raise exception 'Operational sales require the atomic fiscal checkout adapter; historical tax must not be inferred'; end if;

 select jsonb_agg(to_jsonb(g) order by rate_bps,treatment,reason) into summary from (select rate_bps,treatment,reason,sum(base_cents)::bigint base_cents,sum(tax_cents)::bigint tax_cents,sum(total_cents)::bigint total_cents from jsonb_to_recordset(rows) r(rate_bps integer,treatment text,reason text,base_cents bigint,tax_cents bigint,total_cents bigint) group by rate_bps,treatment,reason) g;
 v_series_code:=doc_type||'-'||extract(year from day)::text;
 insert into public.crm_fiscal_series(workspace_id,code,document_type) values(w,v_series_code,doc_type) on conflict do nothing;
 num:=fiscal_private.next_number(p.tax_id,v_series_code);
 update public.crm_fiscal_series set last_number=num where workspace_id=w and crm_fiscal_series.code=v_series_code and document_type=doc_type;
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

create function fiscal_private.checkout(w text,request uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing fiscal_private.checkout_payments; l jsonb; item public.crm_inventory_items; lines jsonb:='[]';doc_lines jsonb:='[]';q numeric;total bigint:=0;sale uuid;document jsonb;v_method text:=body#>>'{payment,method}';v_reference text:=body#>>'{payment,reference}';
begin
 if auth.uid() is null or not fiscal_private.allowed(w,'issue') then raise exception 'Fiscal checkout access required' using errcode='42501'; end if;
 if request is null or jsonb_typeof(body) is distinct from 'object' then raise exception 'Request and checkout object required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fiscal-issue:'||w,0));
 select * into existing from fiscal_private.checkout_payments where workspace_id=w and request_id=request;
 if found then
  if existing.actor<>auth.uid() or existing.request_body<>body then raise exception 'Fiscal checkout reference reused with different details'; end if;
  return jsonb_build_object('sale_id',existing.sale_id,'document_id',existing.document_id);
 end if;
 perform fiscal_private.assert_release(w);
 if (select currency from public.crm_workspaces where id=w) is distinct from 'EUR' then raise exception 'Only EUR checkout supported'; end if;
 if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 200 then raise exception 'Between 1 and 200 lines required'; end if;
 if v_method is null or v_method not in ('cash','card','other') then raise exception 'Payment method required'; end if;
 if v_method<>'cash' and length(btrim(coalesce(v_reference,''))) not between 3 and 120 then raise exception 'Recorded external payment reference required'; end if;
 if v_method<>'cash' and exists(select 1 from fiscal_private.checkout_payments where workspace_id=w and checkout_payments.method=v_method and checkout_payments.reference=v_reference) then raise exception 'Payment reference already recorded'; end if;
 if (select count(distinct x->>'item_id') from jsonb_array_elements(body->'lines') x)<>jsonb_array_length(body->'lines') then raise exception 'Consolidate duplicate products'; end if;
 -- Lock catalogue in UUID order, matching operational checkout's lock order.
 for l in select value from jsonb_array_elements(body->'lines') order by value->>'item_id' loop
  q:=(l->>'quantity')::numeric;
  if q is null or q<=0 or q>999999 or q<>round(q,3) or coalesce((l->>'discount_bps')::integer,0)<>0 then raise exception 'Positive quantities with up to three decimals; checkout discounts not yet supported'; end if;
  select * into item from public.crm_inventory_items where workspace_id=w and id=(l->>'item_id')::uuid and active for update;
  if not found or item.sale_price_cents is null or item.sale_price_cents<0 then raise exception 'Active priced item required'; end if;
  total:=total+round(q*item.sale_price_cents);
  lines:=lines||jsonb_build_array(jsonb_build_object('item_id',item.id,'quantity',q,'unit_price_cents',item.sale_price_cents));
  doc_lines:=doc_lines||jsonb_build_array(jsonb_build_object('item_id',item.id,'quantity',q::text));
 end loop;
 if total>2000000000 or (body->>'expected_total_cents')::numeric is distinct from total::numeric or (body#>>'{payment,amount_cents}')::numeric is distinct from total::numeric then raise exception 'Payment and expected total must equal server total'; end if;
 if v_method='cash' and total>=100000 then raise exception 'Cash unavailable for operations of EUR 1000 or more'; end if;
 sale:=public.crm_record_pos_sale(w,'fiscal-'||v_method,request::text,total::integer,'EUR',auth.uid(),lines);
 insert into fiscal_private.checkout_authorizations values(w,request,sale,auth.uid());
 document:=fiscal_private.issue(w,request,jsonb_build_object('document_type',body->>'document_type','customer',coalesce(body->'customer','{}'),'expected_total_cents',total,'lines',doc_lines,'source_sale_id',sale));
 if (document->>'total_cents')::bigint<>total then raise exception 'Fiscal and operational totals differ'; end if;
 insert into fiscal_private.checkout_payments(workspace_id,request_id,request_body,sale_id,document_id,method,amount_cents,reference,actor) values(w,request,body,sale,(document->>'id')::uuid,v_method,total,v_reference,auth.uid());
 delete from fiscal_private.checkout_authorizations where workspace_id=w and request_id=request;
 return jsonb_build_object('sale_id',sale,'document_id',document->>'id');
end $$;
revoke all on function fiscal_private.checkout(text,uuid,jsonb) from public,anon;
grant execute on function fiscal_private.checkout(text,uuid,jsonb) to authenticated;
create function public.crm_fiscal_checkout(p_workspace text,p_request_id uuid,p_checkout jsonb) returns jsonb language sql set search_path='' as $$select fiscal_private.checkout(p_workspace,p_request_id,p_checkout)$$;
revoke all on function public.crm_fiscal_checkout(text,uuid,jsonb) from public,anon;
grant execute on function public.crm_fiscal_checkout(text,uuid,jsonb) to authenticated;
create or replace function fiscal_private.reverse(w text,request uuid,original uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 num:=fiscal_private.next_number(p.tax_id,v_series_code);
 update public.crm_fiscal_series set last_number=num where workspace_id=w and crm_fiscal_series.code=v_series_code and document_type=kind;
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

commit;
