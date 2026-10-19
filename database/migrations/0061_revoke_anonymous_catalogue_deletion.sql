begin;
revoke all on function public.delete_owned_venue(uuid,text,text) from anon;
revoke all on function public.operator_delete_catalogue_item(text,uuid,text,text) from anon;
commit;
