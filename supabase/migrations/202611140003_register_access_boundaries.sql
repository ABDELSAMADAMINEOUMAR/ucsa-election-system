-- Local rehearsal only. Preserve the reviewed ballot implementation, adding
-- authorization at its boundary rather than duplicating its transaction code.
create function public.finalize_candidate_slate(election_input uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; ids uuid[];
begin
 if not public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],election_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_input for update;
 if not found or e.status not in('draft','prepared') or clock_timestamp()<=e.nominations_end then raise exception 'Finalize after nominations and before voting'; end if;
 if exists(select 1 from public.candidate_applications where election_id=e.id and user_id=auth.uid()) then raise exception 'Independent slate finalization required'; end if;
 if exists(select 1 from public.candidate_slates where election_id=e.id) then return; end if;
 if not exists(select 1 from public.election_registers where election_id=e.id) or not exists(select 1 from public.election_offices where election_id=e.id and is_active)
  or exists(select 1 from public.election_offices o where o.election_id=e.id and o.is_active and not exists(select 1 from public.candidate_applications a where a.office_id=o.id and a.election_id=e.id and a.status='approved')) then raise exception 'Every active office needs an approved candidate and register plan'; end if;
 select array_agg(a.id order by a.id) into ids from public.candidate_applications a join public.election_offices o on o.id=a.office_id and o.is_active where a.election_id=e.id and a.status='approved';
 insert into public.candidate_slates values(e.id,auth.uid(),clock_timestamp(),ids,encode(extensions.digest(ids::text,'sha256'),'hex'));
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'candidate_slate_finalized','candidate_slate',e.id,e.id,'Approved candidates='||cardinality(ids));
end $$;
revoke all on function public.finalize_candidate_slate(uuid) from public,anon;
grant execute on function public.finalize_candidate_slate(uuid) to authenticated;

create function public.freeze_finalized_slate() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform id from public.elections where id=coalesce(new.election_id,old.election_id) for update;
 if exists(select 1 from public.candidate_slates where election_id=coalesce(new.election_id,old.election_id)) then raise exception 'Candidate slate is finalized'; end if;
 return coalesce(new,old);
end $$;
create trigger finalized_candidate_guard before insert or update or delete on public.candidate_applications for each row execute function public.freeze_finalized_slate();

alter function public.create_election(jsonb) rename to legacy_create_election;
revoke all on function public.legacy_create_election(jsonb) from public,anon,authenticated;
create function public.create_election(election_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_active_session() then raise exception 'Not authorized'; end if;
 result:=public.legacy_create_election(election_input);
 insert into public.election_classifications values(result,'synthetic',auth.uid(),clock_timestamp());
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'synthetic_election_created','election',result,result,'Local rehearsal only; official voting disabled');
 return result;
end $$;
alter function public.open_election(uuid) rename to legacy_open_election;
revoke all on function public.legacy_open_election(uuid) from public,anon,authenticated;
create function public.open_election(election_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active_session() then raise exception 'Not authorized'; end if;
 perform id from public.elections where id=election_id_input for update;
 if not exists(select 1 from public.election_classifications where election_id=election_id_input and classification='synthetic') then raise exception 'Real or unclassified election voting is disabled'; end if;
 if not exists(select 1 from public.election_registers where election_id=election_id_input) or not exists(select 1 from public.candidate_slates where election_id=election_id_input)
 or not exists(select 1 from public.election_certification_policies where election_id=election_id_input) then raise exception 'Register plan, finalized candidates and certification policy are required'; end if;
 perform public.legacy_open_election(election_id_input);
end $$;
alter function public.prepare_election(uuid) rename to legacy_prepare_election;
revoke all on function public.legacy_prepare_election(uuid) from public,anon,authenticated;
create function public.prepare_election(election_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active_session() then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.election_registers where election_id=election_id_input) or not exists(select 1 from public.election_certification_policies where election_id=election_id_input) then raise exception 'Approve the register plan and certification policy first'; end if;
 perform public.legacy_prepare_election(election_id_input);
end $$;

alter function public.submit_election_ballot(uuid,jsonb) rename to legacy_submit_election_ballot;
revoke all on function public.legacy_submit_election_ballot(uuid,jsonb) from public,anon,authenticated;
create function public.submit_election_ballot(election_id_input uuid,selections_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 -- Serialize with membership suspension, version approval and binding.
 perform pg_advisory_xact_lock(140002);
 perform id from public.elections where id=election_id_input for update;
 if not public.has_election_student_access(election_id_input) or not exists(select 1 from public.candidate_slates where election_id=election_id_input) then raise exception 'Ballot unavailable'; end if;
 if exists(select 1 from jsonb_to_recordset(selections_input) x(office_id uuid,candidate_application_id uuid) where not exists(select 1 from public.candidate_slates s where s.election_id=election_id_input and x.candidate_application_id=any(s.candidate_ids))) then raise exception 'Ballot unavailable'; end if;
 return public.legacy_submit_election_ballot(election_id_input,selections_input);
end $$;
alter function public.get_open_ballot(uuid) rename to legacy_get_open_ballot;
revoke all on function public.legacy_get_open_ballot(uuid) from public,anon,authenticated;
create function public.get_open_ballot(election_id_input uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if not public.has_election_student_access(election_id_input) or not exists(select 1 from public.candidate_slates where election_id=election_id_input) then raise exception 'Ballot unavailable'; end if;
 return public.legacy_get_open_ballot(election_id_input);
end $$;
create or replace function public.get_my_vote_status(election_id_input uuid) returns table(office_id uuid,recorded_at timestamptz) language sql stable security definer set search_path='' as $$
 select v.office_id,v.recorded_at from public.vote_participation v where v.user_id=auth.uid() and v.election_id=election_id_input and public.has_election_student_access(election_id_input);
$$;

-- Guard existing trusted student RPCs, preserving their full existing definitions.
-- These functions always act as a student, even if that account also has a role.
do $$ declare f record; definition text; guarded text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('update_candidate_draft','submit_candidate_application','record_candidate_photo_upload','submit_complaint','reply_to_complaint') loop
  definition:=pg_get_functiondef(f.oid);
  guarded:=regexp_replace(definition,'\mbegin\M',E'begin\n if not public.has_student_access() then raise exception ''Student activation required''; end if;','i');
  if guarded=definition then raise exception 'Missing student RPC guard'; end if;
  execute guarded;
 end loop;
end $$;
-- Legacy verification cannot substitute for register activation.
create or replace function public.submit_verification_request(registration_number_input text) returns uuid language plpgsql security definer set search_path='' as $$
begin raise exception 'Use official register activation'; end $$;

-- The extra restrictive policy composes with existing owner/role/window policies.
create policy register_elections_read on public.elections as restrictive for select to authenticated using(
 public.has_election_student_access(id) or public.has_committee_role(array['committee_chair','verification_officer','candidate_review_officer','election_administrator','certifying_officer']::public.committee_role[],id));
create policy register_offices_read on public.election_offices as restrictive for select to authenticated using(
 public.has_election_student_access(election_id) or public.has_committee_role(array['committee_chair','verification_officer','candidate_review_officer','election_administrator','certifying_officer']::public.committee_role[],election_id));
create policy register_eligibility_read on public.election_eligibility as restrictive for select to authenticated using(
 public.has_student_access() or public.has_committee_role(array['committee_chair','verification_officer']::public.committee_role[],election_id));
create policy register_applications_read on public.candidate_applications as restrictive for select to authenticated using(
 public.has_election_student_access(election_id) or public.has_committee_role(array['committee_chair','candidate_review_officer']::public.committee_role[],election_id));
create policy register_applications_insert on public.candidate_applications as restrictive for insert to authenticated with check(public.has_election_student_access(election_id) and not exists(select 1 from public.candidate_slates where election_id=candidate_applications.election_id));
create policy register_participation_read on public.vote_participation as restrictive for select to authenticated using(public.has_election_student_access(election_id));
create policy register_verification_read on public.student_verification_requests as restrictive for select to authenticated using(public.has_student_access() or public.has_committee_role(array['committee_chair','verification_officer']::public.committee_role[]));
create policy register_history_read on public.verification_history as restrictive for select to authenticated using(public.has_student_access() or public.has_committee_role(array['committee_chair','verification_officer']::public.committee_role[]));
create policy register_complaints_read on public.complaints as restrictive for select to authenticated using(public.has_student_access() or public.has_committee_role(array['committee_chair','certifying_officer']::public.committee_role[],election_id));

-- Direct Storage cannot bypass an inactive binding for a student. Officers still
-- pass the pre-existing election/owner policies, not just this broad guard.
create policy register_storage_access on storage.objects as restrictive for all to authenticated
using(bucket_id not in('candidate-private','complaint-private') or public.has_student_access() or exists(select 1 from public.committee_members where user_id=auth.uid()))
with check(bucket_id not in('candidate-private','complaint-private') or public.has_student_access());

-- Public real-election projection remains fail-closed. Rehearsal results have
-- a separate authenticated getter and never populate ordinary public results.
alter function public.get_published_election_results(uuid) rename to legacy_get_published_election_results;
revoke all on function public.legacy_get_published_election_results(uuid) from public,anon,authenticated;
create function public.get_published_election_results(election_id_input uuid) returns jsonb language sql stable security definer set search_path='' as $$ select null::jsonb; $$;
create function public.get_rehearsal_results(election_id_input uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_active_session() or (not public.has_election_student_access(election_id_input) and not public.has_committee_role(array['committee_chair','certifying_officer']::public.committee_role[],election_id_input)) then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.election_classifications where election_id=election_id_input and classification='synthetic') then return null; end if;
 return public.legacy_get_published_election_results(election_id_input);
end $$;
create function public.get_my_candidates(election_input uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_election_student_access(election_input) then raise exception 'Not authorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('name',re.full_name,'position',o.title,'motivation',a.manifesto,'experience',a.biography) order by o.display_order,re.full_name),'[]'::jsonb)
 from public.candidate_slates s join public.candidate_applications a on a.id=any(s.candidate_ids) and a.status='approved'
 join public.election_offices o on o.id=a.office_id join public.voter_bindings b on b.user_id=a.user_id
 join public.election_registers er on er.election_id=s.election_id join public.official_register_entries re on re.register_id=er.register_id and re.identity_id=b.identity_id where s.election_id=election_input);
end $$;

-- Apply grants to new wrappers, never their inaccessible legacy implementations.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('create_election','prepare_election','open_election','submit_election_ballot','get_open_ballot','get_rehearsal_results','get_my_candidates') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
revoke all on function public.get_published_election_results(uuid) from public;
grant execute on function public.get_published_election_results(uuid) to anon,authenticated;
