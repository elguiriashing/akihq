begin;

-- The seven-argument package-aware RPC replaces this legacy entry point.
revoke all on function public.submit_business_application(text,text,text,text,text) from public,anon,authenticated;

commit;
