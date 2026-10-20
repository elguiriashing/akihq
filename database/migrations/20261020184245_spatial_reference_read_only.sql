begin;

-- PostGIS owns this reference table. Preserve ownership, extension membership,
-- RLS state and every other role's explicit privileges; clients only need lookup.
revoke all privileges on table public.spatial_ref_sys from public, anon, authenticated;
grant select on table public.spatial_ref_sys to anon, authenticated;

-- A managed extension owner may be required to revoke the original grantor's
-- privileges. Warnings/no-ops or inherited grants must never look like a repair.
do $read_only$
declare client_role text; capability text;
begin
 foreach client_role in array array['anon','authenticated'] loop
  if not has_table_privilege(client_role,'public.spatial_ref_sys','SELECT') then
   raise exception 'Spatial reference lookup privilege missing for %',client_role using errcode='42501';
  end if;
  foreach capability in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
   if has_table_privilege(client_role,'public.spatial_ref_sys',capability) then
    raise exception 'Spatial reference read-only repair did not take effect: % retains %; use an authorised extension-owner executor and review inherited grants',client_role,capability using errcode='42501';
   end if;
  end loop;
  if has_any_column_privilege(client_role,'public.spatial_ref_sys','INSERT')
    or has_any_column_privilege(client_role,'public.spatial_ref_sys','UPDATE')
    or has_any_column_privilege(client_role,'public.spatial_ref_sys','REFERENCES') then
   raise exception 'Spatial reference read-only repair did not take effect: % retains column mutation privileges',client_role using errcode='42501';
  end if;
  if current_setting('server_version_num')::integer >= 170000 then
   if has_table_privilege(client_role,'public.spatial_ref_sys','MAINTAIN') then
    raise exception 'Spatial reference read-only repair did not take effect: % retains MAINTAIN',client_role using errcode='42501';
   end if;
  end if;
 end loop;
end $read_only$;

commit;
