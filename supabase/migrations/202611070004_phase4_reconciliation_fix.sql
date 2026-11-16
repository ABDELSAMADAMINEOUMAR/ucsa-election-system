create or replace function public.reconcile_election_results(election_id_input uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; rec_id uuid; rev integer; offices integer; mismatches integer; summary_value jsonb;
begin
 if not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input for update;
 if not found or e.status<>'closed' or clock_timestamp()<e.voting_end or exists(select 1 from public.election_certifications where election_id=election_id_input) then raise exception 'Election is not ready for reconciliation'; end if;
 select coalesce(max(revision),0)+1 into rev from public.election_reconciliations where election_id=election_id_input;
 select count(*) into offices from public.election_offices where election_id=election_id_input and is_active;
 insert into public.election_reconciliations(election_id,revision,status,ballot_total,participation_total,invalid_total,discrepancy_count,summary,reviewed_by)
 values(election_id_input,rev,'discrepancy',0,0,0,0,'{}',auth.uid()) returning id into rec_id;
 insert into public.election_reconciliation_offices(reconciliation_id,election_id,office_id,ballot_count,participation_count,valid_count,invalid_count,reconciled)
 select rec_id,election_id_input,o.id,
  counts.ballots,counts.participants,counts.valid_votes,counts.invalid_votes,
  counts.ballots=counts.participants and counts.invalid_votes=0
 from public.election_offices o
 cross join lateral (
  select (select count(*) from public.anonymous_ballots b where b.election_id=election_id_input and b.office_id=o.id) ballots,
   (select count(*) from public.vote_participation vp where vp.election_id=election_id_input and vp.office_id=o.id) participants,
   (select count(*) from public.anonymous_ballots b join public.candidate_applications a on a.id=b.candidate_application_id and a.election_id=b.election_id and a.office_id=b.office_id where b.election_id=election_id_input and b.office_id=o.id and a.status='approved') valid_votes,
   (select count(*) from public.anonymous_ballots b left join public.candidate_applications a on a.id=b.candidate_application_id and a.election_id=b.election_id and a.office_id=b.office_id where b.election_id=election_id_input and b.office_id=o.id and a.status is distinct from 'approved') invalid_votes
 ) counts
 where o.election_id=election_id_input and o.is_active;
 select count(*) filter(where not reconciled) + case when offices=0 then 1 else 0 end into mismatches from public.election_reconciliation_offices where reconciliation_id=rec_id;
 if mismatches=0 then
  with candidate_votes as (
   select o.id office_id,a.id candidate_id,p.full_name candidate_name,count(b.ballot_id)::bigint votes
   from public.election_offices o join public.candidate_applications a on a.election_id=o.election_id and a.office_id=o.id and a.status='approved'
   join public.profiles p on p.id=a.user_id
   left join public.anonymous_ballots b on b.election_id=election_id_input and b.office_id=o.id and b.candidate_application_id=a.id
   where o.election_id=election_id_input and o.is_active group by o.id,a.id,p.full_name
  ), ranked as (
   select cv.*,rank() over(partition by cv.office_id order by cv.votes desc) candidate_rank,
    max(cv.votes) over(partition by cv.office_id) top_vote
   from candidate_votes cv
  ), ties as (
   select office_id,count(*) filter(where votes=top_vote) top_count from ranked group by office_id
  ), office_totals as (
   select office_id,ballot_count from public.election_reconciliation_offices where reconciliation_id=rec_id
  )
  insert into public.election_candidate_snapshots(reconciliation_id,election_id,office_id,candidate_application_id,candidate_name,vote_count,percentage,rank,tied_at_top)
  select rec_id,election_id_input,r.office_id,r.candidate_id,r.candidate_name,r.votes,
   case when ot.ballot_count=0 then 0 else round(r.votes::numeric*100/ot.ballot_count::numeric,4) end,
   r.candidate_rank,ot.ballot_count>0 and r.votes=r.top_vote and t.top_count>1
  from ranked r join ties t using(office_id) join office_totals ot using(office_id);
 end if;
 update public.election_reconciliations r set status=case when mismatches=0 then 'passed' else 'discrepancy' end,
  ballot_total=coalesce((select sum(o.ballot_count) from public.election_reconciliation_offices o where o.reconciliation_id=rec_id),0),
  participation_total=coalesce((select sum(o.participation_count) from public.election_reconciliation_offices o where o.reconciliation_id=rec_id),0),
  invalid_total=coalesce((select sum(o.invalid_count) from public.election_reconciliation_offices o where o.reconciliation_id=rec_id),0),
  discrepancy_count=mismatches,
  summary=jsonb_build_object('electionId',election_id_input,'activeOfficeCount',offices,'discrepancyCount',mismatches,'reconciledAt',clock_timestamp()) where r.id=rec_id;
 select jsonb_build_object('id',r.id,'electionId',r.election_id,'revision',r.revision,'status',r.status,'ballotTotal',r.ballot_total,'participationTotal',r.participation_total,'invalidTotal',r.invalid_total,'discrepancyCount',r.discrepancy_count,'summary',r.summary,
  'offices',coalesce((select jsonb_agg(jsonb_build_object('officeId',o.office_id,'ballotCount',o.ballot_count,'participationCount',o.participation_count,'validCount',o.valid_count,'invalidCount',o.invalid_count,'reconciled',o.reconciled)) from public.election_reconciliation_offices o where o.reconciliation_id=r.id),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(jsonb_build_object('officeId',s.office_id,'candidateId',s.candidate_application_id,'name',s.candidate_name,'votes',s.vote_count,'percentage',s.percentage,'rank',s.rank,'tiedAtTop',s.tied_at_top)) from public.election_candidate_snapshots s where s.reconciliation_id=r.id),'[]'::jsonb)) into summary_value from public.election_reconciliations r where r.id=rec_id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'results_reconciled','election_reconciliation',rec_id,election_id_input,'status='||(select status from public.election_reconciliations where id=rec_id)||'; discrepancy_count='||mismatches);
 return summary_value;
end $$;
