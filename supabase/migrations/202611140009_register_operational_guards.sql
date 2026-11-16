create function public.audit_binding_proof() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(new.user_id,'voter_email_proof_recorded','voter_binding',new.user_id,'Approved register version='||new.register_id);
 return new;
end $$;
create trigger binding_proof_audit after insert on public.voter_binding_proofs for each row execute function public.audit_binding_proof();
do $$ declare definition text; begin
 select pg_get_functiondef('public.approve_official_register(uuid,text)'::regprocedure) into definition;
 definition:=replace(definition,'if r.status=''locked'' and r.snapshot_sha256=hash_input then return; end if;',E'if r.status=''locked'' and r.snapshot_sha256=hash_input then return; end if;\n if clock_timestamp()<r.membership_closes then raise exception ''The external membership registration period has not closed''; end if;');
 execute definition;
end $$;
create or replace view public.candidate_review_queue with (security_barrier=true) as
 select a.id,a.election_id,a.office_id,a.user_id,a.biography,a.manifesto,a.status,a.submitted_at,coalesce(re.full_name,p.full_name) as full_name,o.title as office_title,e.title as election_title
 from public.candidate_applications a join public.profiles p on p.id=a.user_id
 join public.election_offices o on o.id=a.office_id join public.elections e on e.id=a.election_id
 join public.election_classifications classification on classification.election_id=e.id and classification.classification='synthetic'
 left join public.voter_bindings b on b.user_id=a.user_id left join public.election_registers er on er.election_id=a.election_id
 left join public.official_register_entries re on re.register_id=er.register_id and re.identity_id=b.identity_id
 where a.status in('submitted','approved','rejected') and public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],a.election_id);
