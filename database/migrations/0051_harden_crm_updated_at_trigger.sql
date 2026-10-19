-- Migration 0051: pin the shared timestamp trigger search path
begin;

alter function public.set_updated_at() set search_path = public;

commit;
