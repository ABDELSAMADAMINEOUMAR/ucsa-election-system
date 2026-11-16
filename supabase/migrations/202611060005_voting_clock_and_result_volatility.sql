-- Evaluate the acceptance clock only after lock acquisition. A request queued
-- behind another ballot must not inherit a time captured before the lock.
create or replace function public.submit_election_ballot(election_id_input uuid, selections_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare voter uuid:=auth.uid(); e public.elections%rowtype; office_count integer; selection_count integer; inserted_count integer; now_at timestamptz;
begin
 if voter is null then raise exception 'Not authorized'; end if;
 if selections_input is null or jsonb_typeof(selections_input)<>'array' or jsonb_array_length(selections_input) not between 1 and 20 then raise exception 'Invalid ballot'; end if;
 if exists(select 1 from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid) where x.office_id is null or x.candidate_application_id is null)
  or (select count(*) from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid))<>(select count(distinct x.office_id) from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid)) then raise exception 'Invalid ballot'; end if;
 select * into e from public.elections where id=election_id_input for update;
 if not found then raise exception 'Ballot unavailable'; end if;
 perform 1 from public.election_offices o where o.election_id=election_id_input and o.is_active order by o.id for update;
 now_at:=clock_timestamp();
 if e.status<>'open' or now_at<e.voting_start or now_at>=e.voting_end then raise exception 'Ballot unavailable'; end if;
 if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=voter and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now_at) and u.email_confirmed_at is not null and p.verification_status='verified')
  or not exists(select 1 from public.election_eligibility x where x.election_id=election_id_input and x.user_id=voter and x.status='verified') then raise exception 'Ballot unavailable'; end if;
 select count(*) into office_count from public.election_offices where election_id=election_id_input and is_active;
 select count(*) into selection_count from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid);
 if office_count=0 or office_count<>selection_count or exists(
  select 1 from public.election_offices o where o.election_id=election_id_input and o.is_active and not exists(select 1 from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid) where x.office_id=o.id)
 ) or exists(
  select 1 from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid)
  where not exists(select 1 from public.election_offices o where o.id=x.office_id and o.election_id=election_id_input and o.is_active)
   or not exists(select 1 from public.candidate_applications a where a.id=x.candidate_application_id and a.election_id=election_id_input and a.office_id=x.office_id and a.status='approved')
 ) then raise exception 'Ballot unavailable'; end if;
 insert into public.vote_participation(election_id,office_id,user_id)
 select election_id_input,x.office_id,voter from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid) order by x.office_id
 on conflict do nothing;
 get diagnostics inserted_count=row_count;
 if inserted_count<>office_count then raise exception 'Ballot unavailable'; end if;
 insert into public.anonymous_ballots(election_id,office_id,candidate_application_id)
 select election_id_input,x.office_id,x.candidate_application_id from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid);
 return jsonb_build_object('recorded',true);
end $$;

create or replace function public.get_open_ballot(election_id_input uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare voter uuid:=auth.uid(); e public.elections%rowtype; result jsonb;
begin
 if voter is null then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input;
 if not found or e.status<>'open' or clock_timestamp()<e.voting_start or clock_timestamp()>=e.voting_end
  or not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=voter and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) and u.email_confirmed_at is not null and p.verification_status='verified')
  or not exists(select 1 from public.election_eligibility x where x.election_id=election_id_input and x.user_id=voter and x.status='verified') then raise exception 'Ballot unavailable'; end if;
 select jsonb_build_object('election',jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'voting_end',e.voting_end), 'offices',coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',p.full_name,'biography',a.biography,'manifesto',a.manifesto) order by p.full_name) from public.candidate_applications a join public.profiles p on p.id=a.user_id where a.election_id=e.id and a.office_id=o.id and a.status='approved'),'[]'::jsonb)) order by o.display_order),'[]'::jsonb))
 into result from public.elections e join public.election_offices o on o.election_id=e.id and o.is_active where e.id=election_id_input group by e.id;
 return result;
end $$;

alter function public.get_closed_election_tally(uuid) volatile;
