begin;
create extension if not exists pgtap with schema extensions;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_depend d on d.objid=p.oid and d.classid='pg_proc'::regclass
 join pg_extension e on e.oid=d.refobjid and d.refclassid='pg_extension'::regclass where e.extname='pgtap' and d.deptype='e'
 loop execute format('grant execute on function %s to anon,authenticated,service_role',f.signature); end loop;
end $$;
select no_plan();
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('85000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','nomination-sql-'||n||'@example.test',now(),'{}','{}',now(),now() from generate_series(1,2) n;
update public.profiles set verification_status='verified' where id::text like '85000000-%';
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where id::text like '85000000-%';
insert into public.elections(id,title,nominations_start,nominations_end,voting_start,voting_end,status,created_by)
values('85100000-0000-4000-8000-000000000001','Synthetic nomination edit tests',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days','draft','85000000-0000-4000-8000-000000000001');
insert into public.election_offices(id,election_id,title,display_order) values('85200000-0000-4000-8000-000000000001','85100000-0000-4000-8000-000000000001','President',0);
insert into public.election_eligibility(election_id,user_id,status,decided_by,decided_at) values('85100000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','verified','85000000-0000-4000-8000-000000000002',now());
insert into public.candidate_applications(id,election_id,office_id,user_id,biography,manifesto,status) values('85300000-0000-4000-8000-000000000001','85100000-0000-4000-8000-000000000001','85200000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001',repeat('b',30),repeat('m',80),'draft');
select ok(not has_table_privilege('authenticated','public.candidate_applications','update'),'draft edits grant no direct table update');
select ok(not has_function_privilege('anon','public.update_candidate_draft(uuid,text,text)','execute'),'anonymous callers have no draft RPC grant');

-- New-model fixture prerequisites. Only Auth/election rows created by THIS
-- rollback-only transaction are included. No production bypass flags/grants.
do $fixture$
declare r uuid:=gen_random_uuid(); actor uuid; snapshot jsonb;
begin
 select id into actor from auth.users where xmin=pg_current_xact_id()::text::xid order by id limit 1;
 select jsonb_agg(jsonb_build_object('fullName',coalesce(nullif(p.full_name,''),'Synthetic Student'),'registrationNumber',coalesce(p.registration_number,'FIX-'||upper(substr(replace(p.id::text,'-',''),1,32))))||jsonb_build_object('email',lower(p.email)) order by p.id) into snapshot
 from public.profiles p join auth.users u on u.id=p.id where u.xmin=pg_current_xact_id()::text::xid;
 insert into public.official_registers(id,title,classification,status,membership_opens,membership_closes,activation_opens,activation_closes,file_name,source_sha256,rows_snapshot,snapshot_sha256,request_key,created_by,approved_by,approved_at)
 values(r,'Rollback-only security fixture','synthetic','locked',now()-interval '2 days',now()-interval '1 day',now()-interval '1 hour',now()+interval '1 day','fixture.json',repeat('a',64),snapshot,encode(extensions.digest(snapshot::text,'sha256'),'hex'),gen_random_uuid(),actor,actor,clock_timestamp()+interval '1 minute');
 insert into public.voter_identities(id) select id from auth.users where xmin=pg_current_xact_id()::text::xid;
 insert into public.official_register_entries select r,p.id,coalesce(p.registration_number,'FIX-'||upper(substr(replace(p.id::text,'-',''),1,32))),lower(p.email),coalesce(nullif(p.full_name,''),'Synthetic Student') from public.profiles p join auth.users u on u.id=p.id where u.xmin=pg_current_xact_id()::text::xid;
 insert into public.voter_bindings select re.identity_id,re.identity_id,r,re.email,clock_timestamp() from public.official_register_entries re where register_id=r;
 insert into public.election_classifications select id,'synthetic',actor,clock_timestamp() from public.elections where xmin=pg_current_xact_id()::text::xid;
 insert into public.election_registers select id,r,'Synthetic fixture eligibility rule',actor,clock_timestamp() from public.elections where xmin=pg_current_xact_id()::text::xid;
 insert into public.register_election_decisions select er.election_id,r,re.identity_id,true,'' from public.election_registers er cross join public.official_register_entries re where er.register_id=r and re.register_id=r;
 insert into public.candidate_slates select e.id,actor,clock_timestamp(),array_agg(a.id order by a.id),repeat('b',64) from public.elections e join public.candidate_applications a on a.election_id=e.id and a.status='approved' where e.xmin=pg_current_xact_id()::text::xid group by e.id;
end $fixture$;

set local role authenticated;
set local request.jwt.claim.sub='85000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"85000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('e',40),repeat('f',100))$$,'eligible owner can edit draft');
select is((select biography from public.candidate_applications where id='85300000-0000-4000-8000-000000000001'),repeat('e',40),'biography changes persist');
select is((select manifesto from public.candidate_applications where id='85300000-0000-4000-8000-000000000001'),repeat('f',100),'manifesto changes persist');
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001','short',repeat('f',100))$$,'P0001',null,'minimum biography checked by database');
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('e',1001),repeat('f',100))$$,'P0001',null,'maximum biography checked by database');
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('e',40),null)$$,'P0001',null,'null content rejected');
set local request.jwt.claim.sub='85000000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"session_id":"85000000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('x',40),repeat('y',100))$$,'P0001',null,'another account cannot edit draft');
set local request.jwt.claim.sub='85000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{}';
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('x',40),repeat('y',100))$$,'P0001',null,'missing live session denied');
set local request.jwt.claims='{"session_id":"85000000-0000-4000-8000-000000000001"}';
reset role;
update public.election_eligibility set status='revoked' where election_id='85100000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('x',40),repeat('y',100))$$,'P0001',null,'revoked election eligibility denied');
reset role;
update public.election_eligibility set status='verified' where election_id='85100000-0000-4000-8000-000000000001';
update public.profiles set verification_status='revoked' where id='85000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('x',40),repeat('y',100))$$,'P0001',null,'revoked identity denied');
reset role;
update public.profiles set verification_status='verified' where id='85000000-0000-4000-8000-000000000001';
update public.elections set nominations_start=now()-interval '2 days',nominations_end=now()-interval '1 day' where id='85100000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('x',40),repeat('y',100))$$,'P0001',null,'closed nomination window denied');
reset role;
update public.elections set nominations_start=now()-interval '1 day',nominations_end=now()+interval '1 day' where id='85100000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.submit_candidate_application('85300000-0000-4000-8000-000000000001')$$,'edited draft can be submitted');
select throws_ok($$select public.update_candidate_draft('85300000-0000-4000-8000-000000000001',repeat('x',40),repeat('y',100))$$,'P0001',null,'submitted application cannot be edited');
select is((select biography from public.candidate_applications where id='85300000-0000-4000-8000-000000000001'),repeat('e',40),'failed edits preserve content');
select * from finish();
rollback;
