create or replace function public.guard_candidate_during_voting() returns trigger language plpgsql security definer set search_path='' as $$
declare election_key uuid; current_status public.election_status;
begin
 election_key:=coalesce(new.election_id,old.election_id);
 select status into current_status from public.elections where id=election_key for update;
 if current_status in('open','closed','pending_certification','certified') then raise exception 'Candidate roster is frozen'; end if;
 return coalesce(new,old);
end $$;
