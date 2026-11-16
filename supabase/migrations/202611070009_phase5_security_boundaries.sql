-- Global administration requires a global membership. Election-scoped grants
-- must never satisfy a global operation simply because its scope is NULL.
create or replace function public.has_committee_role(allowed public.committee_role[],scoped_election uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.committee_members cm join auth.users u on u.id=cm.user_id
  where cm.user_id=(select auth.uid()) and cm.role=any(allowed)
   and (cm.election_id is null or cm.election_id=scoped_election)
   and u.deleted_at is null and u.email_confirmed_at is not null
   and (u.banned_until is null or u.banned_until<=clock_timestamp())
 );
$$;

-- Evidence metadata is a server responsibility, not a client-asserted fact.
revoke execute on function public.record_complaint_document(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.record_complaint_document(uuid,text,text,text,integer) to service_role;

create or replace function public.record_complaint_document(complaint_id_input uuid,path_input text,file_name_input text,mime_input text,size_input integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; c public.complaints%rowtype;
begin
 select * into c from public.complaints where id=complaint_id_input for update;
 if not found or c.status not in('submitted','under_review','awaiting_information')
  or path_input !~ ('^'||c.student_id::text||'/'||c.id::text||'/[0-9a-f-]{36}[.](jpg|png|webp|pdf)$')
  or not exists(select 1 from storage.objects o where o.bucket_id='complaint-private' and o.name=path_input)
 then raise exception 'Evidence upload is not allowed'; end if;
 if mime_input not in('image/jpeg','image/png','image/webp','application/pdf') or size_input not between 1 and 5242880 or char_length(trim(file_name_input)) not between 1 and 120 then raise exception 'Invalid evidence'; end if;
 insert into public.complaint_documents(complaint_id,storage_path,file_name,mime_type,byte_size,uploaded_by)
 values(c.id,path_input,file_name_input,mime_input,size_input,c.student_id) returning id into new_id;
 insert into public.complaint_events(complaint_id,actor_id,event_type,public_note) values(c.id,c.student_id,'evidence_added','Supporting evidence was attached to the complaint.');
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(c.student_id,'complaint_evidence_added','complaint_document',new_id,c.election_id);
 return new_id;
end $$;

-- Preserve candidate identity during voting/results. Before that, reject empty
-- approved-candidate names rather than allowing reconciliation to fail later.
create function public.guard_candidate_profile_name() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.full_name is distinct from old.full_name and exists(
  select 1 from public.candidate_applications a join public.elections e on e.id=a.election_id
  where a.user_id=old.id and a.status='approved' and
   (char_length(trim(new.full_name))=0 or e.status in('open','closed','pending_certification','certified'))
 ) then raise exception 'Approved candidate identity is frozen'; end if;
 return new;
end $$;
revoke all on function public.guard_candidate_profile_name() from public,anon,authenticated;
create trigger candidate_profile_identity_guard before update of full_name on public.profiles
for each row execute function public.guard_candidate_profile_name();

create or replace function public.decide_candidate_application(application_id_input uuid,decision_input public.application_status,reason_input text default '') returns void language plpgsql security definer set search_path='' as $$
declare a public.candidate_applications%rowtype;
begin
 select * into a from public.candidate_applications where id=application_id_input for update;
 if not found or not public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],a.election_id) then raise exception 'Not authorized'; end if;
 if a.user_id=auth.uid() then raise exception 'Independent candidate review required'; end if;
 if not exists(select 1 from public.profiles p where p.id=a.user_id and char_length(trim(p.full_name)) between 1 and 120) then raise exception 'Candidate identity required'; end if;
 if a.status<>'submitted' or decision_input not in ('approved','rejected') or char_length(reason_input)>1000 or (decision_input='rejected' and char_length(trim(reason_input))<3) then raise exception 'Application cannot be decided or rejection reason missing'; end if;
 update public.candidate_applications set status=decision_input where id=a.id;
 insert into public.candidate_review_decisions(application_id,reviewer_id,decision,reason) values(a.id,auth.uid(),decision_input,left(trim(reason_input),1000));
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),decision_input::text,'candidate_application',a.id,a.election_id,left(trim(reason_input),1000));
end $$;


create or replace function public.certify_election_results(election_id_input uuid,reconciliation_id_input uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; policy_row public.election_certification_policies%rowtype; cert_id uuid; cert_ref text; approval_data jsonb; result_data jsonb; hash_value text; recon public.election_reconciliations%rowtype;
begin
 if not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input for update;
 select * into policy_row from public.election_certification_policies where election_id=election_id_input;
 select * into recon from public.election_reconciliations where id=reconciliation_id_input and election_id=election_id_input;
 if not found or e.status<>'closed' or clock_timestamp()<e.voting_end or recon.status<>'passed' or policy_row.id is null
  or exists(select 1 from public.election_reconciliations r where r.election_id=election_id_input and r.revision>recon.revision)
  or exists(select 1 from public.election_certifications where election_id=election_id_input and reconciliation_id=reconciliation_id_input)
  or (policy_row.complaints_required and exists(select 1 from public.complaints c where c.election_id=election_id_input and c.status not in('resolved','rejected','closed')))
  or exists(select 1 from public.election_certification_approvals a where a.reconciliation_id=reconciliation_id_input and a.decision='rejected')
  or exists(select 1 from public.election_certification_approvals a where a.reconciliation_id=reconciliation_id_input and a.decision='approved' and not exists(
   select 1 from public.committee_members cm join auth.users u on u.id=cm.user_id
   where cm.user_id=a.officer_id and cm.role in('certifying_officer','committee_chair')
    and (cm.election_id is null or cm.election_id=election_id_input)
    and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=clock_timestamp())
  ))
  or (select count(*) from public.election_certification_approvals a where a.reconciliation_id=reconciliation_id_input and a.decision='approved')<policy_row.required_approvals then raise exception 'Certification prerequisites are not satisfied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('officerId',a.officer_id,'decision',a.decision,'decidedAt',a.decided_at,'reason',a.reason) order by a.decided_at,a.officer_id),'[]'::jsonb) into approval_data from public.election_certification_approvals a where a.reconciliation_id=reconciliation_id_input and a.decision='approved';
 select jsonb_build_object('electionId',e.id,'title',e.title,'description',e.description,'votingStart',e.voting_start,'votingEnd',e.voting_end,'reconciliationId',recon.id,'revision',recon.revision,'ballotTotal',recon.ballot_total,'participationTotal',recon.participation_total,'offices',coalesce((select jsonb_agg(jsonb_build_object('officeId',ro.office_id,'officeTitle',o.title,'ballotCount',ro.ballot_count,'participationCount',ro.participation_count,'candidates',coalesce((select jsonb_agg(jsonb_build_object('candidateId',cs.candidate_application_id,'name',cs.candidate_name,'votes',cs.vote_count,'percentage',cs.percentage,'rank',cs.rank,'tiedAtTop',cs.tied_at_top) order by cs.rank,cs.candidate_name) from public.election_candidate_snapshots cs where cs.reconciliation_id=recon.id and cs.office_id=ro.office_id),'[]'::jsonb)) order by o.display_order) from public.election_reconciliation_offices ro join public.election_offices o on o.id=ro.office_id where ro.reconciliation_id=recon.id),'[]'::jsonb)) into result_data;
 hash_value:=encode(extensions.digest(convert_to(result_data::text,'UTF8'),'sha256'),'hex');
 cert_ref:='UCSA-CERT-'||to_char(clock_timestamp(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.election_certifications(election_id,reconciliation_id,certification_reference,approval_snapshot,result_snapshot,snapshot_sha256,certified_by)
 values(election_id_input,reconciliation_id_input,cert_ref,approval_data,result_data,hash_value,auth.uid()) returning id into cert_id;
 update public.elections set status='certified',updated_at=clock_timestamp() where id=election_id_input;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'certified','election_certification',cert_id,election_id_input,'reference='||cert_ref||'; snapshot_sha256='||hash_value);
 return jsonb_build_object('id',cert_id,'reference',cert_ref,'certifiedAt',clock_timestamp(),'snapshotSha256',hash_value,'snapshot',result_data,'approvals',approval_data);
end $$;
