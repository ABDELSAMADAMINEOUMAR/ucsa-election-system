-- Direct RPC attempts need the same non-enumerating limits as HTTP. Return a
-- generic false outcome (not an exception) so denied-attempt counters commit.
alter function public.bind_official_voter(text) rename to checked_bind_official_voter;
revoke all on function public.checked_bind_official_voter(text) from public,anon,authenticated;
create function public.bind_official_voter(registration_input text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; allowed boolean;
begin
 if not public.is_active_session() then raise exception 'Not authorized'; end if;
 allowed:=public.consume_public_limit('binding-rpc',encode(extensions.digest(auth.uid()::text,'sha256'),'hex'),10);
 if not allowed then return jsonb_build_object('activated',false); end if;
 begin result:=public.checked_bind_official_voter(registration_input);
 exception when others then return jsonb_build_object('activated',false); end;
 return result;
end $$;
revoke all on function public.bind_official_voter(text) from public,anon;
grant execute on function public.bind_official_voter(text) to authenticated;

-- A second initial upload cannot silently become a correction/replacement.
alter function public.approve_official_register(uuid,text) rename to checked_approve_official_register;
revoke all on function public.checked_approve_official_register(uuid,text) from public,anon,authenticated;
create function public.approve_official_register(register_input uuid,hash_input text) returns void language plpgsql security definer set search_path='' as $$
declare r public.official_registers%rowtype; head uuid;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(140002);
 select * into r from public.official_registers where id=register_input for update;
 if r.status='locked' and r.snapshot_sha256=hash_input then return; end if;
 select id into head from public.official_registers where status='locked' and classification=r.classification order by approved_at desc,id desc limit 1;
 if head is not null and r.parent_id is distinct from head then raise exception 'A current parent and independent correction review are required'; end if;
 perform public.checked_approve_official_register(register_input,hash_input);
end $$;
revoke all on function public.approve_official_register(uuid,text) from public,anon;
grant execute on function public.approve_official_register(uuid,text) to authenticated;

-- New candidacy must continue to satisfy its election plan at every mutation.
create function public.enforce_candidate_register() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Trusted setup/restore is outside ordinary user authority; authenticated
 -- requests always carry auth.uid() and may not use this owner boundary.
 if auth.uid() is not null and new.user_id=auth.uid() and not public.has_election_student_access(new.election_id) then raise exception 'Election eligibility required'; end if;
 return new;
end $$;
create trigger candidate_register_required before insert or update on public.candidate_applications for each row execute function public.enforce_candidate_register();

create function public.committee_register_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare head uuid;
begin
 if not public.has_committee_role(array['committee_chair','verification_officer']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 select id into head from public.official_registers where status='locked' and classification='synthetic' order by approved_at desc,id desc limit 1;
 return jsonb_build_object('approvedVoters',(select count(*) from public.official_register_entries where register_id=head),
  'pendingExceptions',(select count(*) from public.membership_support where status in('pending','reviewed')),
  'registerReady',head is not null,'stagedVersions',(select count(*) from public.official_registers where status='staging'));
end $$;
revoke all on function public.committee_register_summary() from public,anon;
grant execute on function public.committee_register_summary() to authenticated;

-- Ensure no future direct table mutation can remove the classification guard.
create trigger classification_immutable before update or delete on public.election_classifications for each row execute function public.reject_phase4_record_mutation();
