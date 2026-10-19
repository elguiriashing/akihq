begin;

create or replace function public.crm_staff_business_overview()
returns table (
  profile_id uuid,
  display_name text,
  business_tier text,
  venue_count bigint,
  workspaces jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_role(array['moderator','administrator']::public.app_role[]) then
    raise exception 'platform staff required';
  end if;
  return query
  select profile.id,
    coalesce(nullif(btrim(profile.display_name),''),'Business account'),
    profile.business_tier,
    count(distinct member.venue_id),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',workspace.id,
          'name',workspace.name,
          'status',workspace.status,
          'seat_limit',workspace.seat_limit,
          'seat_count',(select count(*) from public.crm_workspace_members seat where seat.workspace_id = workspace.id and seat.status = 'active'),
          'venue_id',workspace.source_venue_id,
          'tools',coalesce((
            select jsonb_object_agg(catalog.tool_key,coalesce(entitlement.active,false) order by catalog.sort_order)
            from public.crm_tool_catalog catalog
            left join public.crm_workspace_entitlements entitlement
              on entitlement.workspace_id = workspace.id and entitlement.tool_key = catalog.tool_key
            where catalog.active and catalog.category <> 'platform'
          ),'{}'::jsonb)
        ) order by workspace.created_at
      )
      from public.crm_workspaces workspace
      where workspace.id <> 'ws_akipasa'
        and workspace.status in ('active','trial')
        and workspace.source_venue_id is not null
        and exists (
          select 1
          from public.venue_members current_owner
          where current_owner.venue_id = workspace.source_venue_id
            and current_owner.profile_id = profile.id
            and current_owner.role = 'owner'::public.venue_member_role
        )
    ),'[]'::jsonb)
  from public.profiles profile
  left join public.venue_members member
    on member.profile_id = profile.id and member.role = 'owner'::public.venue_member_role
  where profile.business_plan_active
     or profile.app_role = 'organiser'::public.app_role
     or member.profile_id is not null
  group by profile.id,profile.display_name,profile.business_tier
  order by profile.business_tier = 'business_pro' desc,coalesce(profile.display_name,''),profile.id;
end;
$$;

update public.crm_workspaces workspace
set owner_profile_id = null
where workspace.id = 'venue-08824b48-6b33-439a-b934-c0df6f4bbf37'
  and workspace.source_venue_id is null
  and workspace.status = 'suspended';

revoke all on function public.crm_staff_business_overview() from public,anon;
grant execute on function public.crm_staff_business_overview() to authenticated;

commit;
