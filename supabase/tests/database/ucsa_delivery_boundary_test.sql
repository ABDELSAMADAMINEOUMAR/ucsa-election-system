begin;
create extension if not exists pgtap with schema extensions;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_depend d on d.objid=p.oid and d.classid='pg_proc'::regclass join pg_extension e on e.oid=d.refobjid and d.refclassid='pg_extension'::regclass where e.extname='pgtap' and d.deptype='e'
 loop execute format('grant execute on function %s to anon,authenticated,service_role',f.signature); end loop;
end $$;
select plan(6);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('be160000-0000-4000-8000-000000000001','authenticated','authenticated','delivery-boundary@example.test','',now(),'{}','{}',now(),now());
insert into public.elections(id,title,description,nominations_start,nominations_end,voting_start,voting_end,status,created_by)
values('be160000-0000-4000-8000-000000000002','Fictional official-class boundary fixture','Never a real election',now()-interval '3 days',now()-interval '2 days',now()-interval '1 hour',now()+interval '1 hour','prepared','be160000-0000-4000-8000-000000000001');
insert into public.election_classifications(election_id,classification,classified_by)
values('be160000-0000-4000-8000-000000000002','official','be160000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.submit_election_ballot('be160000-0000-4000-8000-000000000002','[]')$$,'P0001','Real or unclassified ballot submission is disabled','official classification cannot cast through the database API');
select throws_ok($$select public.submit_election_ballot('be160000-0000-4000-8000-000000000003','[]')$$,'P0001','Real or unclassified ballot submission is disabled','unclassified election fails closed');
select throws_ok($$select public.submit_election_ballot('be160000-0000-4000-8000-000000000002','null')$$,'P0001','Invalid ballot','malformed input validation remains intact');
select ok(not has_function_privilege('authenticated','public.legacy_submit_election_ballot(uuid,jsonb)','EXECUTE'),'authenticated clients cannot bypass the wrapper');
select ok(not has_function_privilege('anon','public.submit_election_ballot(uuid,jsonb)','EXECUTE'),'anonymous clients cannot call the ballot RPC');
reset role;
select is((select count(*) from public.anonymous_ballots where election_id='be160000-0000-4000-8000-000000000002'),0::bigint,'denied attempts leave no ballot');
select * from finish();
rollback;
