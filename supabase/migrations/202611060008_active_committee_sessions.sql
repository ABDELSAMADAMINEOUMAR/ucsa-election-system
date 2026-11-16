-- A still-signed JWT is not sufficient committee authority after an account
-- has been suspended, deleted, or lost confirmed email status.
create or replace function public.has_committee_role(allowed public.committee_role[],scoped_election uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.committee_members cm join auth.users u on u.id=cm.user_id
  where cm.user_id=(select auth.uid()) and cm.role=any(allowed)
   and (scoped_election is null or cm.election_id is null or cm.election_id=scoped_election)
   and u.deleted_at is null and u.email_confirmed_at is not null
   and (u.banned_until is null or u.banned_until<=now())
 );
$$;
