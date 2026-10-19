-- Full published catalogue; rank before pagination, never truncate candidates.
-- Rollback: deploy previous API then drop search_public_venues and search columns.
begin;
create extension if not exists unaccent with schema public;
create or replace function public.venue_search_normalize(value text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select trim(regexp_replace(lower(public.unaccent('public.unaccent'::regdictionary,coalesce(value,''))), '[^a-z0-9]+', ' ', 'g'));
$$;
alter table public.venues add column if not exists search_document tsvector generated always as
  (to_tsvector('simple'::regconfig,public.venue_search_normalize(name || ' ' || coalesce(address,'')))) stored;
create index if not exists venues_public_search_idx on public.venues using gin(search_document) where status='published';

create or replace function public.search_public_venues(p_query text,p_offset integer default 0,p_limit integer default 25)
returns table(id uuid,slug text,name text,address text,discovery_vertical text,total bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare normalized text; query_text text; terms tsquery;
begin
  if p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit<1 or p_limit>50 then
    raise exception 'invalid pagination';
  end if;
  normalized:=public.venue_search_normalize(left(p_query,160));
  if length(normalized)<2 then return; end if;
  select string_agg(quote_literal(token)||':*',' & ') into query_text
  from regexp_split_to_table(normalized,' +') token
  where (length(token)>=2 or token ~ '^[0-9]+$') and token not in ('de','del','el','la','las','los','en','al','the','of','and');
  if query_text is null then return; end if;
  terms:=to_tsquery('simple'::regconfig,query_text);
  return query
  select v.id,v.slug,v.name,v.address,v.discovery_vertical::text,count(*) over()
  from public.venues v where v.status='published' and v.search_document @@ terms
  order by case when public.venue_search_normalize(v.name)=normalized then 0
    when public.venue_search_normalize(v.name) like normalized||'%' then 1 else 2 end,
    public.venue_search_normalize(v.name),v.id
  offset p_offset limit p_limit;
end;
$$;
revoke all on function public.search_public_venues(text,integer,integer) from public;
grant execute on function public.search_public_venues(text,integer,integer) to anon,authenticated,service_role;
commit;
