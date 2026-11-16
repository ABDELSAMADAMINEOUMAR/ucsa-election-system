-- A signed, unexpired access token can outlive logout. Check the live Auth
-- session as well as user state at every application database boundary.
create function public.is_active_session() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from auth.sessions s join auth.users u on u.id=s.user_id
  where s.id::text=(select auth.jwt()->>'session_id') and s.user_id=(select auth.uid())
   and (s.not_after is null or s.not_after>clock_timestamp())
   and u.deleted_at is null and u.email_confirmed_at is not null
   and (u.banned_until is null or u.banned_until<=clock_timestamp())
 );
$$;
revoke all on function public.is_active_session() from public,anon;
grant execute on function public.is_active_session() to authenticated;

create or replace function public.has_committee_role(allowed public.committee_role[],scoped_election uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active_session() and exists(
  select 1 from public.committee_members cm
  where cm.user_id=(select auth.uid()) and cm.role=any(allowed)
   and (cm.election_id is null or cm.election_id=scoped_election)
 );
$$;

-- Apply a common guard to existing trusted user RPCs. Trigger functions and
-- the server-only evidence finalizer do not execute in an end-user session.
-- This migration deliberately uses the definitions installed by preceding
-- migrations; fail if a future function cannot accept the PL/pgSQL guard.
do $$
declare f record; definition text; guarded text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.prosecdef and l.lanname='plpgsql'
   and p.prorettype<>'trigger'::regtype and p.proname<>'record_complaint_document'
 loop
  definition:=pg_get_functiondef(f.oid);
  guarded:=regexp_replace(definition,'\mbegin\M',E'begin\n if not public.is_active_session() then raise exception ''Not authorized''; end if;','i');
  if guarded=definition then raise exception 'Missing user RPC entry point'; end if;
  execute guarded;
 end loop;
 for f in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity
 loop
  execute format('create policy active_session_required on public.%I as restrictive for all to authenticated using ((select public.is_active_session())) with check ((select public.is_active_session()))',f.relname);
 end loop;
end $$;

create or replace function public.get_my_vote_status(election_id_input uuid)
returns table(office_id uuid, recorded_at timestamptz) language sql stable security definer set search_path='' as $$
 select vp.office_id,vp.recorded_at from public.vote_participation vp
 where vp.election_id=election_id_input and vp.user_id=auth.uid() and public.is_active_session();
$$;

-- Storage RLS must also invalidate the old token; signed URLs remain usable
-- for their short lifetime and are a separately documented bearer capability.
create policy candidate_active_session on storage.objects as restrictive for all to authenticated
using (bucket_id not in('candidate-private','complaint-private') or (select public.is_active_session()))
with check (bucket_id not in('candidate-private','complaint-private') or (select public.is_active_session()));
