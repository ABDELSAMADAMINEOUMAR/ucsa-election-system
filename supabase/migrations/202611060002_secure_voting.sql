-- Phase 3 secure voting. Ballots are anonymous relative to application roles,
-- but this conventional database architecture is not anonymous to operators.
alter table public.election_offices add column is_active boolean not null default true;
alter table public.election_offices add constraint election_offices_election_id_unique unique(election_id,id);
alter table public.candidate_applications add constraint candidate_application_election_office_id_unique unique(election_id,office_id,id);

create table public.vote_participation (
 election_id uuid not null references public.elections(id) on delete restrict,
 office_id uuid not null references public.election_offices(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key (election_id, office_id, user_id),
 foreign key (election_id, office_id) references public.election_offices(election_id,id) on delete restrict
);
create index vote_participation_count_idx on public.vote_participation(election_id,office_id);
alter table public.vote_participation enable row level security;
alter table public.vote_participation force row level security;
create policy vote_participation_self_read on public.vote_participation for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.vote_participation from public,anon,authenticated;
grant select on public.vote_participation to authenticated;

create table public.anonymous_ballots (
 ballot_id uuid primary key default gen_random_uuid(),
 election_id uuid not null references public.elections(id) on delete restrict,
 office_id uuid not null references public.election_offices(id) on delete restrict,
 candidate_application_id uuid not null references public.candidate_applications(id) on delete restrict,
 foreign key (election_id,office_id) references public.election_offices(election_id,id) on delete restrict,
 foreign key (election_id,office_id,candidate_application_id) references public.candidate_applications(election_id,office_id,id) on delete restrict
);
create index anonymous_ballots_tally_idx on public.anonymous_ballots(election_id,office_id,candidate_application_id);
alter table public.anonymous_ballots enable row level security;
alter table public.anonymous_ballots force row level security;
revoke all on public.anonymous_ballots from public,anon,authenticated;

create function public.submit_election_ballot(election_id_input uuid, selections_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare voter uuid:=auth.uid(); e public.elections%rowtype; office_count integer; selection_count integer; inserted_count integer; now_at timestamptz:=clock_timestamp();
begin
 if voter is null then raise exception 'Not authorized'; end if;
 if selections_input is null or jsonb_typeof(selections_input)<>'array' or jsonb_array_length(selections_input) not between 1 and 20 then raise exception 'Invalid ballot'; end if;
 if exists(select 1 from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid) where x.office_id is null or x.candidate_application_id is null)
  or (select count(*) from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid))<>(select count(distinct x.office_id) from jsonb_to_recordset(selections_input) as x(office_id uuid,candidate_application_id uuid)) then raise exception 'Invalid ballot'; end if;
 select * into e from public.elections where id=election_id_input for update;
 if not found or e.status<>'open' or now_at<e.voting_start or now_at>=e.voting_end then raise exception 'Ballot unavailable'; end if;
 if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=voter and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now_at) and u.email_confirmed_at is not null and p.verification_status='verified')
  or not exists(select 1 from public.election_eligibility x where x.election_id=election_id_input and x.user_id=voter and x.status='verified') then raise exception 'Ballot unavailable'; end if;
 perform 1 from public.election_offices o where o.election_id=election_id_input and o.is_active order by o.id for update;
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
revoke all on function public.submit_election_ballot(uuid,jsonb) from public,anon;
grant execute on function public.submit_election_ballot(uuid,jsonb) to authenticated;

create function public.get_open_ballot(election_id_input uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
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
revoke all on function public.get_open_ballot(uuid) from public,anon;
grant execute on function public.get_open_ballot(uuid) to authenticated;

create function public.get_my_vote_status(election_id_input uuid)
returns table(office_id uuid, recorded_at timestamptz) language sql stable security definer set search_path='' as $$
 select vp.office_id,vp.recorded_at from public.vote_participation vp where vp.election_id=election_id_input and vp.user_id=auth.uid();
$$;
revoke all on function public.get_my_vote_status(uuid) from public,anon;
grant execute on function public.get_my_vote_status(uuid) to authenticated;

create function public.open_election(election_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; t timestamptz:=clock_timestamp();
begin
 if not public.has_committee_role(array['election_administrator','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input for update;
 if not found or e.status<>'prepared' or t<e.voting_start or t>=e.voting_end or not exists(select 1 from public.election_offices where election_id_input=election_id and is_active)
  or exists(select 1 from public.election_offices o where o.election_id=election_id_input and o.is_active and not exists(select 1 from public.candidate_applications a where a.election_id=election_id_input and a.office_id=o.id and a.status='approved')) then raise exception 'Election cannot be opened'; end if;
 update public.elections set status='open',updated_at=t where id=election_id_input;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'opened','election',election_id_input,election_id_input);
end $$;
create function public.close_election(election_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_committee_role(array['election_administrator','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 update public.elections set status='closed',updated_at=clock_timestamp() where id=election_id_input and status='open';
 if not found then raise exception 'Election cannot be closed'; end if;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'closed','election',election_id_input,election_id_input);
end $$;
create function public.get_closed_election_tally(election_id_input uuid)
returns table(office_id uuid,office_title text,candidate_application_id uuid,candidate_name text,vote_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.elections where id=election_id_input and status='closed' and clock_timestamp()>=voting_end) then raise exception 'Results unavailable'; end if;
 return query select o.id,o.title,a.id,p.full_name,count(b.ballot_id) from public.election_offices o join public.candidate_applications a on a.election_id=o.election_id and a.office_id=o.id and a.status='approved' join public.profiles p on p.id=a.user_id left join public.anonymous_ballots b on b.election_id=election_id_input and b.office_id=o.id and b.candidate_application_id=a.id where o.election_id=election_id_input and o.is_active group by o.id,o.title,o.display_order,a.id,p.full_name order by o.display_order,count(b.ballot_id) desc,p.full_name;
end $$;
revoke all on function public.open_election(uuid),public.close_election(uuid),public.get_closed_election_tally(uuid) from public,anon;
grant execute on function public.open_election(uuid),public.close_election(uuid),public.get_closed_election_tally(uuid) to authenticated;

create function public.freeze_voting_configuration() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.elections e where e.id=coalesce(new.election_id,old.election_id) and e.status in('open','closed','pending_certification','certified')) then raise exception 'Voting configuration is frozen'; end if;
 return coalesce(new,old);
end $$;
create trigger election_offices_frozen before update or delete on public.election_offices for each row execute function public.freeze_voting_configuration();
create trigger election_offices_no_insert_when_open before insert on public.election_offices for each row execute function public.freeze_voting_configuration();
create function public.guard_live_election_schedule() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in('open','closed','pending_certification','certified') and (new.title is distinct from old.title or new.description is distinct from old.description or new.nominations_start is distinct from old.nominations_start or new.nominations_end is distinct from old.nominations_end or new.voting_start is distinct from old.voting_start or new.voting_end is distinct from old.voting_end) then raise exception 'Voting configuration is frozen'; end if;
 return new;
end $$;
create trigger elections_no_schedule_change_when_live before update on public.elections for each row execute function public.guard_live_election_schedule();

-- Election-scoped eligibility is immutable once voting opens.
create function public.guard_eligibility_during_voting() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.elections where id=coalesce(new.election_id,old.election_id) and status='open') then raise exception 'Eligibility is frozen while voting is open'; end if;
 return coalesce(new,old);
end $$;
create trigger eligibility_no_change_when_open before insert or update or delete on public.election_eligibility for each row execute function public.guard_eligibility_during_voting();


-- Grant execute only after trusted functions have narrow role checks.
comment on table public.anonymous_ballots is 'Restricted anonymous selections; no end-user grants or RLS policies. Operator correlation risk remains.';
comment on table public.vote_participation is 'Voter-linked participation only; contains no selection or ballot identifier.';
