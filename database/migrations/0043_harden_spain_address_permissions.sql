begin;

revoke all on function update_venue_location_in_spain(
  uuid,text,text,text,double precision,double precision
) from anon;

commit;
