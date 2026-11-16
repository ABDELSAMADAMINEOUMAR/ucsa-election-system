-- Supabase's inherited object defaults granted more than the explicit grants
-- suggest. The role-filtered join view remains read-only and non-public.
revoke all on public.candidate_review_queue from public,anon,authenticated;
grant select on public.candidate_review_queue to authenticated;
revoke execute on function public.has_committee_role(public.committee_role[],uuid) from public,anon;

-- Trigger functions are invoked through their attached triggers, not RPCs.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prorettype='trigger'::regtype
 loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;

-- Future application migrations must opt into narrowly scoped client grants.
alter default privileges for role postgres in schema public revoke all on tables from anon,authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated;
