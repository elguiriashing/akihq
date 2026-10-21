begin;
-- Privacy-only history remains available when analytics, linking or account features are paused.
create index akipulse_rental_link_subject_export on public.akipulse_rental_workspaces(linked_by,company_id);
create index akipulse_rental_audit_subject_export on akipulse_private.rental_link_audit(actor,id);
create function public.my_pulse_management_export_page(p_section text,p_after text default null,p_limit integer default 500) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member uuid:=auth.uid(); source text; predicate text; cursor_expression text; projection text; total bigint; page jsonb; next_cursor text;
begin
 -- No caller-supplied identity and no account/onboarding/product-access restriction.
 if member is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 500 or (p_after is not null and (length(p_after)>128 or p_after !~ '^[A-Za-z0-9_-]+$')) then raise exception 'Invalid privacy page' using errcode='22023';end if;
 case p_section
 when 'akipulse_rental_workspace_links' then
 source:='public.akipulse_rental_workspaces l';predicate:='l.linked_by=$1';cursor_expression:='l.company_id::text';
 projection:='jsonb_build_object(''company_id'',l.company_id,''workspace_id'',l.workspace_id,''linked_at'',l.linked_at,''linked_by_you'',true)';
 when 'akipulse_rental_link_audit' then
 source:='akipulse_private.rental_link_audit a';predicate:='a.actor=$1';cursor_expression:='lpad(a.id::text,20,''0'')';
 projection:='jsonb_build_object(''reference'',md5(''pulse-link:''||a.id::text),''company_id'',a.company_id,''previous_workspace_id'',a.old_workspace,''workspace_id'',a.new_workspace,''recorded_at'',a.created_at,''actor_is_you'',true)';
 else raise exception 'Unknown privacy section' using errcode='22023';end case;
 execute 'select count(*) from '||source||' where '||predicate into total using member;
 execute 'select coalesce(jsonb_agg(jsonb_build_object(''key'',q.export_key,''data'',q.item) order by q.export_key collate "C"),''[]''::jsonb) from (select '||cursor_expression||' export_key,'||projection||' item from '||source||' where '||predicate||' and ($2::text is null or ('||cursor_expression||') collate "C">$2 collate "C") order by ('||cursor_expression||') collate "C" limit $3)q'
 into page using member,p_after,p_limit+1;
 if jsonb_array_length(page)>p_limit then next_cursor:=page->(p_limit-1)->>'key';page:=page-(jsonb_array_length(page)-1);end if;
 return jsonb_build_object('section',p_section,'total',total,'rows',page,'next_cursor',next_cursor);
end $$;
revoke all on function public.my_pulse_management_export_page(text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.my_pulse_management_export_page(text,text,integer) to authenticated;
commit;
