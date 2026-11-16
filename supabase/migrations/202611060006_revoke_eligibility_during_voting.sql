create or replace function public.guard_eligibility_during_voting() returns trigger language plpgsql set search_path='' as $$
declare election_key uuid; current_status public.election_status;
begin
 election_key:=coalesce(new.election_id,old.election_id);
 select status into current_status from public.elections where id=election_key for update;
 if current_status='open' then
  -- Election opening freezes grants and edits. Security revocation remains
  -- possible so an identity/roster correction can stop further submissions.
  if tg_op='UPDATE' and old.status='verified' and new.status in('revoked','rejected') then return new; end if;
  raise exception 'Eligibility is frozen while voting is open';
 end if;
 return coalesce(new,old);
end $$;
