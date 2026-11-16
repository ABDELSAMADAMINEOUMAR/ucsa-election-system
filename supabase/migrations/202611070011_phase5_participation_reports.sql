-- Preserve privacy bands after certification, including authorized certifiers.
create or replace function public.get_election_participation_summary(election_id_input uuid)
returns table(eligible_band text,participation_band text,withheld boolean)
language plpgsql volatile security definer set search_path='' as $$
declare eligible_count bigint; participation_count bigint;
begin
 if not public.has_committee_role(array['election_administrator','certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.elections where id=election_id_input and status in('closed','certified') and clock_timestamp()>=voting_end) then raise exception 'Participation summary unavailable'; end if;
 select count(*) into eligible_count from public.election_eligibility where election_id=election_id_input and status='verified';
 if eligible_count<20 then return query select 'withheld'::text,'withheld'::text,true; return; end if;
 select count(distinct user_id) into participation_count from public.vote_participation where election_id=election_id_input;
 return query select
  case when eligible_count<50 then '20–49' when eligible_count<100 then '50–99' when eligible_count<250 then '100–249' else '250+' end,
  case when participation_count<20 then '0–19' when participation_count<50 then '20–49' when participation_count<100 then '50–99' when participation_count<250 then '100–249' else '250+' end,
  false;
end $$;
