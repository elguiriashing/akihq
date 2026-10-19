-- Keep an allergen review confirmed across saves/publishes while the
-- recipe/allergen fingerprint remains unchanged. Existing client edits already
-- clear reviewConfirmed when allergen-relevant data changes, and the server
-- preserves reviewedAt only when the fingerprint is unchanged.

CREATE OR REPLACE FUNCTION public.save_venue_catalogue(p_venue uuid, p_expected_revision integer, p_document jsonb, p_publish boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_current public.venue_catalogues%rowtype; v_document jsonb:=p_document; v_section jsonb; v_item jsonb; v_old_item jsonb; v_allergens jsonb; v_variant jsonb; v_seen text[]:='{}'; v_si integer:=0; v_ii integer; v_total integer:=0; v_review timestamptz; v_new_revision integer; v_ids text[]:=array['gluten','crustaceans','eggs','fish','peanuts','soy','milk','nuts','celery','mustard','sesame','sulphites','lupin','molluscs']; v_key text;
begin
 if auth.uid() is null or not public.is_venue_member(p_venue) then raise exception 'Venue editor required' using errcode='42501'; end if;
 perform 1 from public.venues where id=p_venue for update;
 if not found then raise exception 'Venue not found'; end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid revision'; end if;
 if p_document is null or octet_length(p_document::text)>400000 or coalesce(p_document->>'schemaVersion','')<>'1' or not public.catalogue_text_valid(p_document->'title',160,true) or not public.catalogue_text_valid(p_document->'description',1200) or coalesce(p_document->>'layout','') not in('menu','cards','services','rentals','experiences') or coalesce(jsonb_typeof(p_document->'sections'),'')<>'array' or jsonb_array_length(p_document->'sections')>30 then raise exception 'Invalid catalogue'; end if;
 insert into public.venue_catalogues(venue_id) values(p_venue) on conflict do nothing;
 select * into v_current from public.venue_catalogues where venue_id=p_venue for update;
 if v_current.revision<>p_expected_revision then raise exception 'Catalogue changed. Reload before saving.' using errcode='40001'; end if;
 for v_section in select value from jsonb_array_elements(p_document->'sections') loop
 perform(v_section->>'id')::uuid;
 if v_section->>'id' is null or(v_section->>'id')=any(v_seen) or not public.catalogue_text_valid(v_section->'title',160,true) or coalesce(jsonb_typeof(v_section->'items'),'')<>'array' then raise exception 'Invalid section'; end if;
 v_seen:=array_append(v_seen,v_section->>'id'); v_ii:=0;
 for v_item in select value from jsonb_array_elements(v_section->'items') loop
 v_total:=v_total+1; perform(v_item->>'id')::uuid;
 if v_total>150 or v_item->>'id' is null or(v_item->>'id')=any(v_seen) or not public.catalogue_text_valid(v_item->'name',160,true) or not public.catalogue_text_valid(v_item->'description',1200) or coalesce(v_item->>'kind','') not in('food','drink','product','service','rental','experience','ticket','package') or coalesce(jsonb_typeof(v_item->'visible'),'')<>'boolean' or coalesce(jsonb_typeof(v_item->'containsFood'),'')<>'boolean' or coalesce(v_item->>'availability','') not in('available','sold_out','seasonal','on_request') or coalesce(v_item->>'priceMode','') not in('fixed','from','on_request') or coalesce(v_item->>'unit','') not in('each','person','session','hour','day','night','month','kg') or coalesce(jsonb_typeof(v_item->'variants'),'')<>'array' or jsonb_array_length(v_item->'variants')>20 then raise exception 'Invalid item'; end if;
 v_seen:=array_append(v_seen,v_item->>'id');
 if(v_item->>'priceMode'<>'on_request' and v_item->>'priceCents' is null) or(v_item->>'priceCents' is not null and((v_item->>'priceCents')::numeric<>trunc((v_item->>'priceCents')::numeric) or(v_item->>'priceCents')::numeric not between 0 and 100000000)) then raise exception 'Invalid price'; end if;
 if v_item->>'durationMinutes' is not null and(v_item->>'durationMinutes')::integer not between 1 and 43200 then raise exception 'Invalid duration'; end if;
 if v_item->>'capacity' is not null and(v_item->>'capacity')::integer not between 1 and 10000 then raise exception 'Invalid capacity'; end if;
 if v_item->>'imagePath' is not null and not exists(select 1 from public.venue_media where venue_id=p_venue and storage_path=v_item->>'imagePath') then raise exception 'Choose an image from this venue'; end if;
 for v_variant in select value from jsonb_array_elements(v_item->'variants') loop
 perform(v_variant->>'id')::uuid;
 if v_variant->>'id' is null or(v_variant->>'id')=any(v_seen) or not public.catalogue_text_valid(v_variant->'label',100,true) or v_variant->>'priceCents' is null or(v_variant->>'priceCents')::numeric<>trunc((v_variant->>'priceCents')::numeric) or(v_variant->>'priceCents')::numeric not between 0 and 100000000 or coalesce(v_variant->>'unit','') not in('each','person','session','hour','day','night','month','kg') then raise exception 'Invalid price option'; end if;
 v_seen:=array_append(v_seen,v_variant->>'id'); end loop;
 v_allergens:=v_item->'allergens';
 if coalesce(jsonb_typeof(v_allergens->'states'),'')<>'object' or(select count(*) from jsonb_object_keys(v_allergens->'states'))<>14 or coalesce(jsonb_typeof(v_allergens->'cereals'),'')<>'array' or coalesce(jsonb_typeof(v_allergens->'nuts'),'')<>'array' or coalesce(v_allergens->>'crossContact','') not in('unknown','possible','assessed') or not public.catalogue_text_valid(v_allergens->'ingredients',1200) or not public.catalogue_text_valid(v_allergens->'notes',600) then raise exception 'Invalid allergen information'; end if;
 foreach v_key in array v_ids loop if coalesce(v_allergens->'states'->>v_key,'') not in('unknown','contains','may_contain','not_in_recipe') then raise exception 'Invalid allergen state'; end if; end loop;
 if exists(select 1 from jsonb_array_elements_text(v_allergens->'cereals') k where k not in('wheat','rye','barley','oats','spelt','khorasan')) or exists(select 1 from jsonb_array_elements_text(v_allergens->'nuts') k where k not in('almond','hazelnut','walnut','cashew','pecan','brazil','pistachio','macadamia')) then raise exception 'Invalid allergen detail'; end if;
 v_review:=null;
 if v_item->>'kind' in('food','drink') or(v_item->>'containsFood')::boolean then
 select i into v_old_item from jsonb_array_elements(coalesce(v_current.draft_document->'sections','[]')) s cross join lateral jsonb_array_elements(s->'items') i where i->>'id'=v_item->>'id' limit 1;
 if coalesce((v_allergens->>'reviewConfirmed')::boolean,false) then
 if exists(select 1 from jsonb_each_text(v_allergens->'states') a where a.value='unknown') then raise exception 'Check all 14 allergens before confirming'; end if;
 if(v_allergens->'states'->>'gluten' in('contains','may_contain') and jsonb_array_length(v_allergens->'cereals')=0) or(v_allergens->'states'->>'nuts' in('contains','may_contain') and jsonb_array_length(v_allergens->'nuts')=0) then raise exception 'Specify the cereals or nuts'; end if;
 v_review:=now();
 elsif v_old_item is not null and public.catalogue_recipe_fingerprint(v_old_item)=public.catalogue_recipe_fingerprint(v_item) then v_review:=(v_old_item->'allergens'->>'reviewedAt')::timestamptz; end if;
 if p_publish and(v_item->>'visible')::boolean and v_review is null then raise exception 'ALLERGEN_REVIEW_REQUIRED'; end if; end if;
 v_allergens:=jsonb_set(jsonb_set(v_allergens,'{reviewedAt}',coalesce(to_jsonb(v_review),'null'::jsonb)),'{reviewConfirmed}',to_jsonb(v_review is not null));
 v_document:=jsonb_set(v_document,array['sections',v_si::text,'items',v_ii::text,'allergens'],v_allergens); v_ii:=v_ii+1;
 end loop; v_si:=v_si+1; end loop;
 v_new_revision:=v_current.revision+1;
 update public.venue_catalogues set revision=v_new_revision,draft_document=v_document,updated_at=now(),updated_by=auth.uid(),published_document=case when p_publish then v_document else published_document end,published_revision=case when p_publish then v_new_revision else published_revision end,published_at=case when p_publish then now() else published_at end where venue_id=p_venue;
 insert into public.venue_catalogue_history(venue_id,revision,action,document,actor_id) values(p_venue,v_new_revision,case when p_publish then 'publish' else 'draft' end,v_document,auth.uid());
 if p_publish then
 delete from public.venue_catalogue_food_index where venue_id=p_venue;
 insert into public.venue_catalogue_food_index(venue_id,item_id,source_revision,name_es,name_en,contains_allergens,may_contain_allergens,unknown_allergens,not_in_recipe_allergens,cross_contact,reviewed_at)
 select p_venue,(i->>'id')::uuid,v_new_revision,i->'name'->>'es',i->'name'->>'en',array(select key from jsonb_each_text(i->'allergens'->'states') where value='contains'),array(select key from jsonb_each_text(i->'allergens'->'states') where value='may_contain'),array(select key from jsonb_each_text(i->'allergens'->'states') where value='unknown'),array(select key from jsonb_each_text(i->'allergens'->'states') where value='not_in_recipe'),i->'allergens'->>'crossContact',(i->'allergens'->>'reviewedAt')::timestamptz from jsonb_array_elements(v_document->'sections') s cross join lateral jsonb_array_elements(s->'items') i where(i->>'kind' in('food','drink') or(i->>'containsFood')::boolean) and(i->>'visible')::boolean and i->>'availability'='available'; end if;
 return jsonb_build_object('revision',v_new_revision,'document',v_document,'publishedRevision',case when p_publish then v_new_revision else v_current.published_revision end);
end; $function$
;
