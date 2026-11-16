-- Phase 4 hardening: private evidence path resolution, committee complaint listing,
-- policy changes before close, and append-only audit/snapshot records.
create or replace function public.configure_election_certification_policy(election_id_input uuid,approvals_input smallint,reference_input text,complaints_required_input boolean,allow_reopen_input boolean)
returns void language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input for update;
 if not found or e.status not in('draft','prepared','closed') or approvals_input not between 1 and 5 or char_length(trim(reference_input)) not between 5 and 500
  or exists(select 1 from public.election_certifications where election_id=election_id_input) then raise exception 'Invalid certification policy'; end if;
 insert into public.election_certification_policies(election_id,required_approvals,policy_reference,complaints_required,allow_reopen,configured_by)
 values(election_id_input,approvals_input,trim(reference_input),complaints_required_input,allow_reopen_input,auth.uid())
 on conflict(election_id) do update set required_approvals=excluded.required_approvals,policy_reference=excluded.policy_reference,complaints_required=excluded.complaints_required,allow_reopen=excluded.allow_reopen,configured_by=auth.uid(),configured_at=now(),updated_at=now();
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'certification_policy_configured','certification_policy',null,election_id_input,'Policy reference: '||left(trim(reference_input),450));
end $$;

create function public.list_committee_complaints(election_id_input uuid default null)
returns table(id uuid,reference_code text,election_id uuid,category text,status public.complaint_status,created_at timestamptz,student_name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Not authorized'; end if;
 return query select c.id,c.reference_code,c.election_id,c.category,c.status,c.created_at,p.full_name
 from public.complaints c join public.profiles p on p.id=c.student_id
 where (election_id_input is null or c.election_id=election_id_input)
 and public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id)
 order by c.created_at desc limit 500;
end $$;
revoke all on function public.list_committee_complaints(uuid) from public,anon;
grant execute on function public.list_committee_complaints(uuid) to authenticated;

create function public.get_complaint_document_path(complaint_id_input uuid,document_id_input uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare c public.complaints%rowtype; storage_path_value text;
begin
 select * into c from public.complaints where id=complaint_id_input;
 if not found or (c.student_id<>auth.uid() and not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id)) then raise exception 'Evidence unavailable'; end if;
 select d.storage_path into storage_path_value from public.complaint_documents d where d.id=document_id_input and d.complaint_id=complaint_id_input;
 if storage_path_value is null then raise exception 'Evidence unavailable'; end if;
 return storage_path_value;
end $$;
revoke all on function public.get_complaint_document_path(uuid,uuid) from public,anon;
grant execute on function public.get_complaint_document_path(uuid,uuid) to authenticated;

create function public.reject_phase4_record_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
 raise exception 'This election record is append-only';
end $$;

create trigger election_candidate_snapshots_immutable before update or delete on public.election_candidate_snapshots for each row execute function public.reject_phase4_record_mutation();
create trigger election_certifications_immutable before update or delete on public.election_certifications for each row execute function public.reject_phase4_record_mutation();
create trigger election_certification_approvals_immutable before update or delete on public.election_certification_approvals for each row execute function public.reject_phase4_record_mutation();
create trigger election_publications_immutable before update or delete on public.election_publications for each row execute function public.reject_phase4_record_mutation();
create trigger election_result_corrections_immutable before update or delete on public.election_result_corrections for each row execute function public.reject_phase4_record_mutation();
create trigger complaint_events_immutable before update or delete on public.complaint_events for each row execute function public.reject_phase4_record_mutation();
