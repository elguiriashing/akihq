-- Optional operational course holds. Existing uncoursed orders are unchanged.
-- Generated with Supabase CLI 2.121.0; apply only after the KDS migration in staging.
-- No fiscal issuance, card capture, printer acknowledgement or inventory changes.
begin;

create function akihq_hospitality.course_sendable(p_lines jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(l order by n),'[]'::jsonb)
 from jsonb_array_elements(p_lines) with ordinality x(l,n)
 where coalesce((l->>'course_held')::boolean,false)=false;
$$;

create function akihq_hospitality.course_assign(p_before jsonb,p_lines jsonb,p_command jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare prior jsonb; course_number integer; result jsonb;
begin
 if not (p_command ? 'course') then return p_lines; end if;
 if coalesce(p_command->>'course','') !~ '^[0-6]$' then raise exception 'Choose a course from 0 to 6'; end if;
 course_number:=(p_command->>'course')::integer;
 select l into prior from jsonb_array_elements(p_before->'lines') l where l->>'id'=p_command->>'line_id';
 if prior is null then raise exception 'Course line not found'; end if;
 if coalesce((prior->>'course')::integer,0)=course_number then return p_lines; end if;
 if exists(select 1 from jsonb_array_elements(p_before->'sent') l where l->>'id'=prior->>'id') then
  raise exception 'Sent items cannot be held or moved to another course; review kitchen changes instead';
 end if;
 select coalesce(jsonb_agg(case when l->>'id'=prior->>'id' then
   (l-'course_fired_at')||jsonb_build_object('course',course_number,'course_held',course_number>0)
   else l end order by n),'[]') into result
 from jsonb_array_elements(p_lines) with ordinality x(l,n);
 return result;
end $$;

-- Optional course on Add is validated after the catalogue-owned line is created.
create function akihq_hospitality.course_new_line(p_lines jsonb,p_command jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare n integer:=jsonb_array_length(p_lines)-1; c integer;
begin
 if not (p_command ? 'course') then return p_lines; end if;
 if coalesce(p_command->>'course','') !~ '^[0-6]$' then raise exception 'Choose a course from 0 to 6'; end if;
 c:=(p_command->>'course')::integer;
 if c=0 then return p_lines; end if;
 return jsonb_set(p_lines,array[n::text],(p_lines->n)||jsonb_build_object('course',c,'course_held',true));
end $$;

-- Firing only changes operational metadata, never item identity, quantity or price.
create function akihq_hospitality.course_unmarked(p_lines jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(l-'course_held'-'course_fired_at' order by n),'[]')
 from jsonb_array_elements(p_lines) with ordinality x(l,n);
$$;

-- Extend the authoritative RPC in place. Contract checks deliberately fail the
-- migration on an unexpected deployed function body rather than guessing.
do $patch$
declare definition text; needle text; replacement text;
begin
 definition:=pg_get_functiondef('public.crm_hospitality_command(text,uuid,jsonb)'::regprocedure);
 needle:=$old$  elsif a='line' then$old$;
 replacement:=$new$   o.lines:=akihq_hospitality.course_new_line(o.lines,p_command);
  elsif a='line' then$new$;
 if strpos(definition,needle)=0 then raise exception 'Course migration: add command contract mismatch'; end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$  elsif a='note' then$old$;
 replacement:=$new$   o.lines:=akihq_hospitality.course_assign(old_o,o.lines,p_command);
  elsif a='note' then$new$;
 if strpos(definition,needle)=0 then raise exception 'Course migration: line command contract mismatch'; end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$  elsif a='send' then
   if o.lines=o.sent then raise exception 'No item changes to send'; end if;
   foreach station in array array['kitchen','bar'] loop
    select coalesce(jsonb_agg(x),'[]') into lines from jsonb_array_elements(o.lines) x where x->>'station'=station;
    select coalesce(jsonb_agg(x),'[]') into selected from jsonb_array_elements(o.sent) x where x->>'station'=station;
    if lines<>selected then insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(p_workspace,o.id,station,'preparation',jsonb_build_object('instruction','REVISION — compare previous and current; prepare only changes','order',to_jsonb(o),'previous',selected,'current',lines)); end if;
   end loop;o.sent:=o.lines;$old$;
 replacement:=$new$  elsif a='send' then
   if akihq_hospitality.course_sendable(o.lines)=o.sent then raise exception 'No ready item changes to send; held courses need explicit firing'; end if;
   foreach station in array array['kitchen','bar'] loop
    select coalesce(jsonb_agg(x),'[]') into lines from jsonb_array_elements(akihq_hospitality.course_sendable(o.lines)) x where x->>'station'=station;
    select coalesce(jsonb_agg(x),'[]') into selected from jsonb_array_elements(o.sent) x where x->>'station'=station;
    if lines<>selected then insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(p_workspace,o.id,station,'preparation',jsonb_build_object('instruction','REVISION — compare previous and current; prepare only changes. Held courses are excluded.','order',to_jsonb(o),'previous',selected,'current',lines)); end if;
   end loop;o.sent:=akihq_hospitality.course_sendable(o.lines);$new$;
 if strpos(definition,needle)=0 then raise exception 'Course migration: preparation command contract mismatch'; end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$    if paid+amount=total then$old$;
 replacement:=$new$    if paid+amount=total then
     if exists(select 1 from jsonb_array_elements(o.lines) held_dish where (held_dish->>'course_held')::boolean) then
      raise exception 'Fire held courses or remove them before recording the final payment';
     end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'Course migration: final payment contract mismatch'; end if;
 definition:=replace(definition,needle,replacement);
 execute definition;

 definition:=pg_get_functiondef('public.crm_hospitality_overview(text)'::regprocedure);
 needle:=$old$'server_time',now()$old$;
 if strpos(definition,needle)=0 then raise exception 'Course migration: overview contract mismatch'; end if;
 execute replace(definition,needle,$new$'course_contract_version',1,'server_time',now()$new$);

 -- A deliberate new course is not an accidental relocation or an edit to dishes
 -- already cooking. Any other change still requires the existing reconciliation.
 definition:=pg_get_functiondef('akihq_hospitality.kds_order_changed()'::regprocedure);
 needle:=$old$ elsif tg_op='UPDATE' and (new.table_id$old$;
 replacement:=$new$ elsif tg_op='UPDATE' and new.table_id is not distinct from old.table_id
   and new.label is not distinct from old.label and new.note is not distinct from old.note
   and new.lines is distinct from old.lines and new.sent is distinct from old.sent
   and akihq_hospitality.course_unmarked(new.lines)=akihq_hospitality.course_unmarked(old.lines)
   and exists(select 1 from jsonb_array_elements(old.lines) l where (l->>'course_held')::boolean)
   then kind:='course_fire';
 elsif tg_op='UPDATE' and (new.table_id$new$;
 if strpos(definition,needle)=0 then raise exception 'Course migration: KDS trigger contract mismatch'; end if;
 execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('akihq_hospitality.kds_sync(jsonb,text)'::regprocedure);
 needle:=$old$or (ls is distinct from c.source->'lines' and c.source->'lines'<>'[]');$old$;
 replacement:=$new$or (ls is distinct from c.source->'lines' and c.source->'lines'<>'[]'
     and not (p_kind='course_fire' and not exists(
       select 1 from jsonb_array_elements(c.source->'lines') prior_dish
       where not exists(select 1 from jsonb_array_elements(ls) next_dish where next_dish=prior_dish))));$new$;
 if strpos(definition,needle)=0 then raise exception 'Course migration: KDS revision contract mismatch'; end if;
 execute replace(definition,needle,replacement);
end $patch$;

-- Same workspace lock, live permission checks and durable command journal as the
-- rest of the POS. The existing abandon/retry mechanism covers this RPC too.
create function public.crm_course_command(p_workspace text,p_key uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); prior akihq_hospitality.commands%rowtype;
 o akihq_hospitality.orders%rowtype; before_order jsonb; response jsonb;
 course_number integer; released jsonb; old_sent jsonb; station_name text;
 previous_lines jsonb; current_lines jsonb; station_release jsonb;
begin
 perform akihq_hospitality.guard(p_workspace);
 if p_key is null or jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>30000 then raise exception 'Invalid course command'; end if;
 perform pg_advisory_xact_lock(hashtextextended('akihq-hospitality:'||p_workspace,0));
 select * into prior from akihq_hospitality.commands where workspace_id=p_workspace and key=p_key;
 if found then
  if prior.actor<>actor or prior.request<>p_command then raise exception 'Request reference already used'; end if;
  return prior.response;
 end if;
 if p_command->>'action' is distinct from 'course_fire' then raise exception 'Unknown course command'; end if;
 if p_command->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirm the dishes to fire'; end if;
 if coalesce(p_command->>'course','') !~ '^[1-6]$' then raise exception 'Choose a held course from 1 to 6'; end if;
 course_number:=(p_command->>'course')::integer;
 select * into o from akihq_hospitality.orders where workspace_id=p_workspace and id=(p_command->>'order_id')::uuid for update;
 if not found or o.status<>'open' then raise exception 'Open order required for course firing'; end if;
 if (p_command->>'version')::bigint is distinct from o.version then raise exception 'Order changed; reload and review the held dishes' using errcode='PT409'; end if;
 before_order:=to_jsonb(o);old_sent:=o.sent;
 select coalesce(jsonb_agg(l||jsonb_build_object('course_held',false,'course_fired_at',now()) order by n),'[]') into released
 from jsonb_array_elements(o.lines) with ordinality x(l,n)
 where (l->>'course')::integer=course_number and (l->>'course_held')::boolean;
 if released='[]' then raise exception 'No held dishes in this course'; end if;
 if exists(select 1 from jsonb_array_elements(released) r join jsonb_array_elements(o.sent) s on r->>'id'=s->>'id') then
  raise exception 'Previously sent items cannot be fired again; contact support';
 end if;
 select jsonb_agg(coalesce((select r from jsonb_array_elements(released) r where r->>'id'=l->>'id'),l) order by n)
 into o.lines from jsonb_array_elements(o.lines) with ordinality x(l,n);
 -- Preserve unsent edits/removals of other dishes. Firing this course is not an
 -- implicit Send All, cancellation, payment or instruction to cook old dishes.
 -- Keep current menu order for unchanged dishes even when courses fire out of
 -- entry order. Retain removed-but-not-yet-sent cancellations at the end.
 select jsonb_agg(sent_dish order by coalesce((
   select line_n from jsonb_array_elements(o.lines) with ordinality entry(line_dish,line_n)
   where line_dish->>'id'=sent_dish->>'id'),2147483647),sent_n)
 into o.sent from jsonb_array_elements(o.sent||released) with ordinality prior_sent(sent_dish,sent_n);
 update akihq_hospitality.orders set lines=o.lines,sent=o.sent,version=version+1,updated_at=now()
 where workspace_id=p_workspace and id=o.id returning * into o;
 foreach station_name in array array['kitchen','bar'] loop
  select coalesce(jsonb_agg(l),'[]') into station_release from jsonb_array_elements(released) l where l->>'station'=station_name;
  if station_release='[]' then continue; end if;
  select coalesce(jsonb_agg(l),'[]') into previous_lines from jsonb_array_elements(old_sent) l where l->>'station'=station_name;
  select coalesce(jsonb_agg(l),'[]') into current_lines from jsonb_array_elements(o.sent) l where l->>'station'=station_name;
  insert into akihq_hospitality.tickets(workspace_id,order_id,station,kind,payload) values(
   p_workspace,o.id,station_name,'preparation',jsonb_build_object(
    'instruction','FIRE COURSE / MARCHAR TIEMPO — prepare only the NEWLY FIRED dishes. Previous dishes are not a new order.',
    'order',to_jsonb(o),'previous',previous_lines,'current',current_lines,
    'course',course_number,'released',station_release));
 end loop;
 response:=jsonb_build_object('order_id',o.id,'version',o.version,'course',course_number,'fired_lines',jsonb_array_length(released));
 insert into akihq_hospitality.events(workspace_id,order_id,actor,command_id,action,metadata,before_state,after_state)
 values(p_workspace,o.id,actor,p_key,'course_fire',p_command,before_order,to_jsonb(o));
 insert into akihq_hospitality.commands(workspace_id,key,actor,request,response) values(p_workspace,p_key,actor,p_command,response);
 return response;
end $$;

revoke all on function akihq_hospitality.course_sendable(jsonb),akihq_hospitality.course_new_line(jsonb,jsonb),akihq_hospitality.course_assign(jsonb,jsonb,jsonb),akihq_hospitality.course_unmarked(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.crm_course_command(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_course_command(text,uuid,jsonb) to authenticated;
commit;
