-- Avoid ambiguity between the PL/pgSQL election variable and SQL alias e.
create or replace function public.get_open_ballot(election_id_input uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare voter uuid:=auth.uid(); election_row public.elections%rowtype; result jsonb;
begin
 if not public.is_active_session() then raise exception 'Not authorized'; end if;
 if voter is null then raise exception 'Not authorized'; end if;
 select * into election_row from public.elections where id=election_id_input;
 if not found or election_row.status<>'open' or clock_timestamp()<election_row.voting_start or clock_timestamp()>=election_row.voting_end
  or not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=voter and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) and u.email_confirmed_at is not null and p.verification_status='verified')
  or not exists(select 1 from public.election_eligibility x where x.election_id=election_id_input and x.user_id=voter and x.status='verified') then raise exception 'Ballot unavailable'; end if;
 select jsonb_build_object('election',jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'voting_end',e.voting_end), 'offices',coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',p.full_name,'biography',a.biography,'manifesto',a.manifesto) order by p.full_name) from public.candidate_applications a join public.profiles p on p.id=a.user_id where a.election_id=e.id and a.office_id=o.id and a.status='approved'),'[]'::jsonb)) order by o.display_order),'[]'::jsonb))
 into result from public.elections e join public.election_offices o on o.election_id=e.id and o.is_active where e.id=election_id_input group by e.id;
 return result;
end $$;
