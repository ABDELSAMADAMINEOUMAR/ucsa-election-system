-- Email corrections retain the original permanent person/account claim and
-- append verified ownership proofs, rather than freeing or rewriting a binding.
create table public.voter_binding_proofs (
 user_id uuid not null references public.voter_bindings(user_id), email text not null,
 register_id uuid not null references public.official_registers(id), proved_at timestamptz not null default clock_timestamp(),
 primary key(user_id,email,register_id)
);
alter table public.voter_binding_proofs enable row level security;
alter table public.voter_binding_proofs force row level security;
revoke all on public.voter_binding_proofs from public,anon,authenticated;
create trigger binding_proofs_immutable before update or delete on public.voter_binding_proofs for each row execute function public.reject_phase4_record_mutation();
create or replace function public.has_student_access() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active_session() and exists(
  select 1 from public.voter_bindings b join public.voter_identities i on i.id=b.identity_id and i.status='active'
  join auth.users u on u.id=b.user_id
  join public.official_register_entries re on re.identity_id=b.identity_id and re.email=lower(u.email)
  join public.official_registers r on r.id=re.register_id and r.status='locked' and r.classification='synthetic'
  where b.user_id=auth.uid() and (b.proof_email=lower(u.email) or exists(select 1 from public.voter_binding_proofs proof where proof.user_id=b.user_id and proof.email=lower(u.email) and proof.register_id=r.id))
   and r.id=(select latest.id from public.official_registers latest where latest.status='locked' and latest.classification='synthetic' order by latest.approved_at desc,latest.id desc limit 1)
 );
$$;
create or replace function public.has_election_student_access(election_input uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_student_access() and exists(
  select 1 from public.voter_bindings b join auth.users u on u.id=b.user_id join public.election_registers er on er.election_id=election_input
  join public.official_register_entries re on re.register_id=er.register_id and re.identity_id=b.identity_id and re.email=lower(u.email)
  join public.register_election_decisions d on d.election_id=er.election_id and d.identity_id=b.identity_id and d.included
  join public.election_classifications c on c.election_id=er.election_id and c.classification='synthetic'
  join public.election_eligibility ee on ee.election_id=er.election_id and ee.user_id=b.user_id and ee.status='verified'
  where b.user_id=auth.uid()
 );
$$;
do $$ declare definition text; begin
 select pg_get_functiondef('public.checked_bind_official_voter(text)'::regprocedure) into definition;
 definition:=replace(definition,'existing.identity_id<>entry.identity_id or existing.proof_email<>email_value','existing.identity_id<>entry.identity_id');
 definition:=replace(definition,'-- Materialize only already-authorized election decisions, with the officer''s provenance.',E'insert into public.voter_binding_proofs(user_id,email,register_id) values(auth.uid(),email_value,r.id) on conflict do nothing;\n update public.profiles set verification_status=''verified'' where id=auth.uid() and verification_status<>''verified'';\n -- Materialize only already-authorized election decisions, with the officer''s provenance.');
 execute definition;
 select pg_get_functiondef('public.get_my_membership()'::regprocedure) into definition;
 definition:=replace(definition,'re.email=b.proof_email','re.email=(select lower(email) from auth.users where id=auth.uid())');
 execute definition;
end $$;

alter function public.close_election(uuid) rename to checked_close_election;
revoke all on function public.checked_close_election(uuid) from public,anon,authenticated;
create function public.close_election(election_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active_session() or not exists(select 1 from public.election_classifications where election_id=election_id_input and classification='synthetic') then raise exception 'Only classified local rehearsals may be controlled'; end if;
 perform public.checked_close_election(election_id_input);
end $$;
revoke all on function public.close_election(uuid) from public,anon;
grant execute on function public.close_election(uuid) to authenticated;

alter function public.finalize_candidate_slate(uuid) rename to checked_finalize_candidate_slate;
revoke all on function public.checked_finalize_candidate_slate(uuid) from public,anon,authenticated;
create function public.finalize_candidate_slate(election_input uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active_session() then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(140002);
 perform id from public.elections where id=election_input for update;
 if exists(select 1 from public.candidate_applications a where a.election_id=election_input and a.status='approved' and not exists(
  select 1 from public.voter_bindings b join public.voter_identities i on i.id=b.identity_id and i.status='active'
  join auth.users u on u.id=b.user_id and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=clock_timestamp())
  join public.election_registers er on er.election_id=a.election_id join public.official_register_entries re on re.register_id=er.register_id and re.identity_id=b.identity_id and re.email=lower(u.email)
  join public.register_election_decisions d on d.election_id=a.election_id and d.identity_id=b.identity_id and d.included
  join public.election_eligibility ee on ee.election_id=a.election_id and ee.user_id=b.user_id and ee.status='verified'
  where b.user_id=a.user_id)) then raise exception 'Approved candidates must still satisfy the designated register and election rules'; end if;
 perform public.checked_finalize_candidate_slate(election_input);
end $$;
revoke all on function public.finalize_candidate_slate(uuid) from public,anon;
grant execute on function public.finalize_candidate_slate(uuid) to authenticated;
