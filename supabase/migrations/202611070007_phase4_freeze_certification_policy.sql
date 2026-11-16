create or replace function public.configure_election_certification_policy(election_id_input uuid,approvals_input smallint,reference_input text,complaints_required_input boolean,allow_reopen_input boolean)
returns void language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input for update;
 if not found or e.status not in('draft','prepared','closed') or approvals_input not between 1 and 5 or char_length(trim(reference_input)) not between 5 and 500
  or exists(select 1 from public.election_reconciliations where election_id=election_id_input)
  or exists(select 1 from public.election_certifications where election_id=election_id_input) then raise exception 'Invalid certification policy'; end if;
 insert into public.election_certification_policies(election_id,required_approvals,policy_reference,complaints_required,allow_reopen,configured_by)
 values(election_id_input,approvals_input,trim(reference_input),complaints_required_input,allow_reopen_input,auth.uid())
 on conflict(election_id) do update set required_approvals=excluded.required_approvals,policy_reference=excluded.policy_reference,complaints_required=excluded.complaints_required,allow_reopen=excluded.allow_reopen,configured_by=auth.uid(),configured_at=now(),updated_at=now();
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'certification_policy_configured','certification_policy',null,election_id_input,'Policy reference: '||left(trim(reference_input),450));
end $$;
