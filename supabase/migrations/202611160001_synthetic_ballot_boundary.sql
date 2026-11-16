-- Safety boundary: no existing ballot, identity, result or policy rows change.
create or replace function public.submit_election_ballot(election_id_input uuid,selections_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if selections_input is null or jsonb_typeof(selections_input)<>'array' then raise exception 'Invalid ballot'; end if;
 perform pg_advisory_xact_lock(140002);
 perform id from public.elections where id=election_id_input for update;
 if not exists(select 1 from public.election_classifications c where c.election_id=election_id_input and c.classification='synthetic') then
  raise exception 'Real or unclassified ballot submission is disabled';
 end if;
 if not public.has_election_student_access(election_id_input) or not exists(select 1 from public.candidate_slates where election_id=election_id_input) then raise exception 'Ballot unavailable'; end if;
 if exists(select 1 from jsonb_to_recordset(selections_input) x(office_id uuid,candidate_application_id uuid) where not exists(select 1 from public.candidate_slates s where s.election_id=election_id_input and x.candidate_application_id=any(s.candidate_ids))) then raise exception 'Ballot unavailable'; end if;
 return public.legacy_submit_election_ballot(election_id_input,selections_input);
end $$;
revoke all on function public.submit_election_ballot(uuid,jsonb) from public,anon;
grant execute on function public.submit_election_ballot(uuid,jsonb) to authenticated;
comment on function public.submit_election_ballot(uuid,jsonb) is 'Synthetic rehearsals only; real voting remains disabled pending independent review and separate release authorization.';
