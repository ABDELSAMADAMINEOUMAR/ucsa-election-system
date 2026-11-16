-- Compute report totals inside PostgreSQL so PostgREST's row cap cannot silently
-- truncate an official aggregate. Return no names, descriptions or evidence.
create function public.get_election_complaint_summary(election_id_input uuid)
returns table(category text,status public.complaint_status,case_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.elections e where e.id=election_id_input and e.status in('closed','certified') and clock_timestamp()>=e.voting_end) then raise exception 'Report unavailable'; end if;
 return query select c.category,c.status,count(*) from public.complaints c where c.election_id=election_id_input group by c.category,c.status order by c.category,c.status;
end $$;
revoke all on function public.get_election_complaint_summary(uuid) from public,anon;
grant execute on function public.get_election_complaint_summary(uuid) to authenticated;
