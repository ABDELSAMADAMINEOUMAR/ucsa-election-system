-- Serialize candidate roster changes with election opening; once voting starts,
-- no candidate application content or status can change.
create function public.guard_candidate_during_voting() returns trigger language plpgsql set search_path='' as $$
declare election_key uuid; current_status public.election_status;
begin
 election_key:=coalesce(new.election_id,old.election_id);
 select status into current_status from public.elections where id=election_key for update;
 if current_status in('open','closed','pending_certification','certified') then raise exception 'Candidate roster is frozen'; end if;
 return coalesce(new,old);
end $$;
create trigger candidate_roster_frozen before insert or update or delete on public.candidate_applications for each row execute function public.guard_candidate_during_voting();
