create function public.bound_candidate_name(election_input uuid,user_input uuid) returns text language sql stable security definer set search_path='' as $$
 select re.full_name from public.voter_bindings b join public.election_registers er on er.election_id=election_input join public.official_register_entries re on re.register_id=er.register_id and re.identity_id=b.identity_id where b.user_id=user_input;
$$;
revoke all on function public.bound_candidate_name(uuid,uuid) from public,anon,authenticated;
do $$ declare f record; definition text; guarded text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('legacy_get_open_ballot','get_closed_election_tally','reconcile_election_results') loop
  definition:=pg_get_functiondef(f.oid);
  guarded:=replace(definition,'p.full_name','coalesce(public.bound_candidate_name(election_id_input,p.id),p.full_name)');
  execute guarded;
 end loop;
 select pg_get_functiondef('public.checked_bind_official_voter(text)'::regprocedure) into definition;
 guarded:=replace(definition,'set registration_number=entry.registration_number,verification_status=''verified''','set registration_number=entry.registration_number,verification_status=''verified'',full_name=case when exists(select 1 from public.candidate_applications a join public.elections e on e.id=a.election_id where a.user_id=auth.uid() and a.status=''approved'' and e.status in(''open'',''closed'',''pending_certification'',''certified'')) then full_name else entry.full_name end');
 if guarded=definition then raise exception 'Missing activation profile boundary'; end if;
 execute guarded;
end $$;
create or replace view public.candidate_review_queue with (security_barrier=true) as
 select a.id,a.election_id,a.office_id,a.user_id,a.biography,a.manifesto,a.status,a.submitted_at,coalesce(re.full_name,p.full_name) as full_name,o.title as office_title,e.title as election_title
 from public.candidate_applications a join public.profiles p on p.id=a.user_id
 join public.election_offices o on o.id=a.office_id join public.elections e on e.id=a.election_id
 left join public.voter_bindings b on b.user_id=a.user_id left join public.election_registers er on er.election_id=a.election_id
 left join public.official_register_entries re on re.register_id=er.register_id and re.identity_id=b.identity_id
 where a.status in('submitted','approved','rejected') and public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],a.election_id);
