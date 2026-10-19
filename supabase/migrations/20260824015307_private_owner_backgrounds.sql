begin;

alter table public.owner_console_preferences
  add column background_image_path text
  check (
    background_image_path is null
    or (
      char_length(background_image_path) between 40 and 180
      and background_image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
  );

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('owner-backgrounds','owner-backgrounds',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy owner_backgrounds_self_read on storage.objects for select to authenticated
using (
  bucket_id='owner-backgrounds'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and public.has_owner_console()
);

create policy owner_backgrounds_self_upload on storage.objects for insert to authenticated
with check (
  bucket_id='owner-backgrounds'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and public.has_owner_console()
);

create policy owner_backgrounds_self_delete on storage.objects for delete to authenticated
using (
  bucket_id='owner-backgrounds'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and public.has_owner_console()
);

create function public.set_owner_background_image(p_path text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.has_owner_console() then raise exception 'owner console required'; end if;
  if p_path is not null then
    if split_part(p_path,'/',1) <> (select auth.uid())::text then
      raise exception 'invalid owner background path';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id='owner-backgrounds'
        and name=p_path
        and (storage.foldername(name))[1]=(select auth.uid())::text
    ) then raise exception 'owner background not found';
    end if;
  end if;

  update public.owner_console_preferences
  set background_image_path=p_path,updated_at=now()
  where profile_id=(select auth.uid());

  insert into public.moderation_actions(actor_id,action,target_type,target_id,reason,metadata)
  values(
    (select auth.uid()),'owner_background_updated','owner_console',(select auth.uid()),
    'Owner console private background updated',
    jsonb_build_object('has_custom_background',p_path is not null)
  );
end;
$$;

revoke all on function public.set_owner_background_image(text) from public,anon;
grant execute on function public.set_owner_background_image(text) to authenticated;

commit;
