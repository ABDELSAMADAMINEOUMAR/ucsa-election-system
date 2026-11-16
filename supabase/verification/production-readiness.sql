-- Read-only metadata checks. No account, student, register or ballot rows returned.
select jsonb_build_object(
 'application_tables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'forced_rls_tables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity),
 'tables_without_forced_rls', (select coalesce(jsonb_agg(c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not(c.relrowsecurity and c.relforcerowsecurity)),
 'policies', (select count(*) from pg_policies where schemaname='public'),
 'indexes', (select count(*) from pg_indexes where schemaname='public'),
 'constraints', (select count(*) from pg_constraint where connamespace='public'::regnamespace),
 'user_triggers', (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage') and not t.tgisinternal),
 'functions', (select count(*) from pg_proc where pronamespace='public'::regnamespace),
 'definer_functions_without_fixed_search_path', (select coalesce(jsonb_agg(p.proname),'[]'::jsonb) from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef and not exists(select 1 from unnest(p.proconfig) setting where setting like 'search_path=%')),
 'authenticated_can_insert_committee', has_table_privilege('authenticated','public.committee_members','INSERT'),
 'authenticated_can_update_committee', has_table_privilege('authenticated','public.committee_members','UPDATE'),
 'authenticated_can_execute_legacy_ballot', has_function_privilege('authenticated','public.legacy_submit_election_ballot(uuid,jsonb)','EXECUTE'),
 'anon_can_execute_ballot', has_function_privilege('anon','public.submit_election_ballot(uuid,jsonb)','EXECUTE'),
 'real_ballot_guard_present', position('Real or unclassified ballot submission is disabled' in pg_get_functiondef('public.submit_election_ballot(uuid,jsonb)'::regprocedure))>0,
 'committee_admin_is_privileged_function', has_function_privilege('authenticated','public.manage_committee_member(uuid,public.committee_role,uuid,text)','EXECUTE'),
 'committee_admin_definer', (select prosecdef from pg_proc where oid='public.manage_committee_member(uuid,public.committee_role,uuid,text)'::regprocedure),
 'private_buckets', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit)),'[]'::jsonb) from storage.buckets where id in('candidate-private','complaint-private')),
 'storage_policies', (select coalesce(jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'roles',roles,'qual',qual,'check',with_check)),'[]'::jsonb) from pg_policies where schemaname='storage' and tablename='objects')
) as verification;
