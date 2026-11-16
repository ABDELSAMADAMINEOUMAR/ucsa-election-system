create or replace function public.get_certification_workspace(election_id_input uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; result jsonb; latest_id uuid;
begin
 if not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input;
 if not found or e.status in('open','prepared','draft') then raise exception 'Certification workspace unavailable'; end if;
 select id into latest_id from public.election_reconciliations where election_id=election_id_input order by revision desc limit 1;
 select jsonb_build_object('election',jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'status',e.status,'votingStart',e.voting_start,'votingEnd',e.voting_end),
  'policy',(select to_jsonb(p)-'configured_by' from public.election_certification_policies p where p.election_id=e.id),
  'unresolvedComplaints',(select count(*) from public.complaints c where c.election_id=e.id and c.status not in('resolved','rejected','closed')),
  'reconciliation',case when latest_id is null then null else (select to_jsonb(r)||jsonb_build_object('offices',coalesce((select jsonb_agg(to_jsonb(o)) from public.election_reconciliation_offices o where o.reconciliation_id=r.id),'[]'::jsonb),'candidates',coalesce((select jsonb_agg(to_jsonb(cs)) from public.election_candidate_snapshots cs where cs.reconciliation_id=r.id),'[]'::jsonb)) from public.election_reconciliations r where r.id=latest_id) end,
  'approvals',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'officerId',a.officer_id,'decision',a.decision,'reason',a.reason,'decidedAt',a.decided_at)) from public.election_certification_approvals a where a.reconciliation_id=latest_id),'[]'::jsonb),
  'certifications',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'reference',c.certification_reference,'certifiedAt',c.certified_at,'certifiedBy',c.certified_by,'snapshotSha256',c.snapshot_sha256,'snapshot',c.result_snapshot)) from public.election_certifications c where c.election_id=e.id),'[]'::jsonb),
  'publications',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'version',p.publication_version,'publishedAt',p.published_at,'publishedBy',p.published_by)) from public.election_publications p where p.election_id=e.id),'[]'::jsonb),
  'corrections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'reference',c.correction_reference,'reason',c.reason,'note',c.proposed_note,'recordedAt',c.recorded_at,'recordedBy',c.recorded_by)) from public.election_result_corrections c where c.election_id=e.id),'[]'::jsonb)) into result;
 return result;
end $$;
