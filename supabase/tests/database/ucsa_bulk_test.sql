begin;
create extension if not exists pgtap with schema extensions;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_depend d on d.objid=p.oid and d.classid='pg_proc'::regclass join pg_extension e on e.oid=d.refobjid and d.refclassid='pg_extension'::regclass where e.extname='pgtap' and d.deptype='e'
 loop execute format('grant execute on function %s to anon,authenticated,service_role',f.signature); end loop;
end $$;
select no_plan();
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('86000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'authenticated','authenticated','bulkfixture-'||i||'@example.test','',case when i=6 then null else now() end,'{}',jsonb_build_object('full_name','BulkFixture '||i),now(),now() from generate_series(1,8) i;
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where id::text like '86000000-0000-4000-8000-%';
insert into public.committee_members(user_id,role,election_id) values
 ('86000000-0000-4000-8000-000000000001','committee_chair',null),
 ('86000000-0000-4000-8000-000000000002','verification_officer',null),
 ('86000000-0000-4000-8000-000000000003','candidate_review_officer',null);
insert into public.elections(id,title,nominations_start,nominations_end,voting_start,voting_end,created_by) values
 ('86200000-0000-4000-8000-000000000001','Bulk fixture election',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days','86000000-0000-4000-8000-000000000001'),
 ('86200000-0000-4000-8000-000000000002','Other bulk fixture election',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days','86000000-0000-4000-8000-000000000001');
insert into public.eligible_students(registration_number,verified_email,roster_status) values
 ('REG-BULK-4','bulkfixture-4@example.test','approved'),('REG-BULK-5','mismatch-bulk@example.test','approved'),('REG-BULK-6','bulkfixture-6@example.test','approved'),('REG-BULK-DUP','bulkfixture-7@example.test','approved');
insert into public.student_verification_requests(id,user_id,requested_registration_number)
select ('86100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('86000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i>=7 then 'REG-BULK-DUP' else 'REG-BULK-'||i end from generate_series(4,8) i;

set local role anon;
select throws_ok($$select public.review_verification_queue()$$,'42501',null,'anonymous users cannot access private queue');
select throws_ok($$select public.bulk_decide_student_verification(array['86100000-0000-4000-8000-000000000004']::uuid[],'verified','')$$,'42501',null,'anonymous users cannot invoke bulk verification');
reset role;
set local request.jwt.claim.sub='86000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"86000000-0000-4000-8000-000000000004"}';
set local role authenticated;
select throws_ok($$select public.review_verification_queue()$$,'P0001',null,'student cannot read committee queue');
select throws_ok($$select public.bulk_decide_student_verification(array['86100000-0000-4000-8000-000000000004']::uuid[],'verified','')$$,'P0001',null,'student cannot bulk verify self');
select throws_ok($$select public.import_roster_details('[]')$$,'P0001',null,'student cannot import private roster');
select throws_ok($$select * from public.preview_roster_records('[{"registration_number":"REG-BULK-4","email":"bulkfixture-4@example.test"}]')$$,'P0001',null,'student cannot use private roster preview');
select is((select count(*) from public.eligible_students),0::bigint,'student cannot see private roster');
reset role;
set local request.jwt.claim.sub='86000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"session_id":"86000000-0000-4000-8000-000000000003"}';
set local role authenticated;
select throws_ok($$select public.review_verification_queue()$$,'P0001',null,'candidate officer cannot review identity queue');
reset role;
set local request.jwt.claim.sub='86000000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"session_id":"86000000-0000-4000-8000-000000000002"}';
set local role authenticated;
select is((public.review_verification_queue(1,25,'BulkFixture','pending')->>'total')::integer,5,'authorized queue has exact filtered total');
select is(jsonb_array_length(public.review_verification_queue(1,2,'BulkFixture','pending')->'records'),2,'queue pagination is bounded');
select is((select count(*) from public.eligible_students),0::bigint,'verification officer gets match outcomes without roster access');
select throws_ok($$select * from public.preview_roster_records('[{"registration_number":"REG-BULK-4","email":"bulkfixture-4@example.test"}]')$$,'P0001',null,'verification officer cannot read private roster preview');
select ok(exists(select 1 from jsonb_array_elements(public.review_verification_queue(1,25,'BulkFixture','pending')->'records') r where r->>'id'='86100000-0000-4000-8000-000000000004' and r->>'match_status'='matched'),'exact identifier and email produce matched outcome');
select ok(exists(select 1 from jsonb_array_elements(public.review_verification_queue(1,25,'BulkFixture','pending')->'records') r where r->>'id'='86100000-0000-4000-8000-000000000006' and r->>'match_status'='account_unconfirmed'),'unconfirmed account is flagged');
select ok(exists(select 1 from jsonb_array_elements(public.review_verification_queue(1,25,'BulkFixture','pending')->'records') r where r->>'match_status'='duplicate'),'duplicate registration requests are flagged');
select throws_ok($$select public.bulk_decide_student_verification(array['86100000-0000-4000-8000-000000000004','86100000-0000-4000-8000-000000000004']::uuid[],'verified','')$$,'P0001',null,'duplicate decision IDs rejected');
select throws_ok($$select public.bulk_decide_student_verification(array['86100000-0000-4000-8000-000000000005']::uuid[],'rejected','')$$,'P0001',null,'bulk rejection needs reason');
create temporary table bulk_results as select * from public.bulk_decide_student_verification(array['86100000-0000-4000-8000-000000000004','86100000-0000-4000-8000-000000000005','86100000-0000-4000-8000-000000000006','86100000-0000-4000-8000-000000000007']::uuid[],'verified','Approved exact roster match');
select is((select count(*) from bulk_results),4::bigint,'bulk returns an outcome per requested record');
select is((select count(*) from bulk_results where success),1::bigint,'only confirmed exact unduplicated match succeeds');
select is((select error_code from bulk_results where request_id='86100000-0000-4000-8000-000000000007'),'duplicate','duplicate request stays pending');
select is((select count(*) from public.election_eligibility where user_id='86000000-0000-4000-8000-000000000004'),0::bigint,'identity verification never creates election eligibility');
select is((select error_code from public.bulk_decide_student_verification(array['86100000-0000-4000-8000-000000000004']::uuid[],'verified','retry')),'not_pending','repeat/concurrent winner cannot be approved twice');
select is((select success from public.bulk_decide_student_verification(array['86100000-0000-4000-8000-000000000005']::uuid[],'rejected','Reviewed email mismatch')),true,'reasoned bulk rejection is supported');
reset role;
select is((select count(*) from public.verification_history where user_id='86000000-0000-4000-8000-000000000004'),1::bigint,'one approval creates exactly one history entry');
select is((select count(*) from public.admin_audit_events where entity_id='86100000-0000-4000-8000-000000000004' and actor_id='86000000-0000-4000-8000-000000000002' and action='verified'),1::bigint,'approval audit identifies responsible committee member');
select ok(exists(select 1 from public.student_verification_requests where id='86100000-0000-4000-8000-000000000004' and reviewed_at is not null and reviewer_id='86000000-0000-4000-8000-000000000002'),'decision and timestamp recorded');
set local role authenticated;
create temporary table eligibility_results as select * from public.bulk_decide_election_eligibility('86200000-0000-4000-8000-000000000001',array['86000000-0000-4000-8000-000000000004','86000000-0000-4000-8000-000000000005']::uuid[],'verified','Explicit fixture election decision');
select is((select count(*) from eligibility_results where success),1::bigint,'bulk eligibility rechecks each identity');
select is((select error_code from public.bulk_decide_election_eligibility('86200000-0000-4000-8000-000000000001',array['86000000-0000-4000-8000-000000000004']::uuid[],'verified','retry')),'not_pending','repeated eligibility approval does not create another decision');
select is((select count(*) from public.election_eligibility where election_id='86200000-0000-4000-8000-000000000002'),0::bigint,'eligibility never propagates to another election');
select throws_ok($$select public.import_roster_details('[{"registration_number":"REG-BULK-IMPORT","email":"bulk-import@example.test","status":"approved","expected":null}]')$$,'P0001',null,'verification officer cannot import roster');
reset role;
set local request.jwt.claim.sub='86000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"86000000-0000-4000-8000-000000000001"}';
set local role authenticated;
select is(public.import_roster_details('[{"registration_number":"REG-BULK-IMPORT","email":"bulk-import@example.test","status":"approved","full_name":"Imported Fixture","academic_program":"Computing","expected":null}]'),1,'confirmed new roster preview imports metadata through existing audit path');
select is((select full_name from public.eligible_students where registration_number='REG-BULK-IMPORT'),'Imported Fixture','private roster metadata saved');
select is((select count(*) from public.preview_roster_records('[{"registration_number":"REG-BULK-IMPORT","email":"bulk-import@example.test"}]')),1::bigint,'chair preview returns only requested roster matches');
select is((select count(*) from public.preview_roster_records('[{"registration_number":"REG-BULK-NONE","email":"nonexistent-bulk@example.test"}]')),0::bigint,'chair preview never returns the full roster for unmatched inputs');
select throws_ok($$select * from public.preview_roster_records((select jsonb_agg(jsonb_build_object('registration_number','REG-BULK-'||i,'email','bulk-'||i||'@example.test')) from generate_series(1,251) i))$$,'P0001',null,'roster preview rejects oversized batches');
select throws_ok($$select public.import_roster_details('[{"registration_number":"REG-BULK-IMPORT","email":"changed@example.test","status":"approved","expected":null}]')$$,'P0001',null,'stale roster preview is rejected');
select is((select verified_email from public.eligible_students where registration_number='REG-BULK-IMPORT'),'bulk-import@example.test','stale import never changes existing roster');
select throws_ok($$select public.import_roster_details('[{"registration_number":"REG-BULK-OTHER","email":"bulk-import@example.test","status":"approved","expected":null}]')$$,'23505',null,'conflicting email rejected atomically by existing uniqueness rule');
reset role;
select is((select count(*) from public.admin_audit_events where actor_id='86000000-0000-4000-8000-000000000001' and action='roster_import'),1::bigint,'only successful roster import creates its audit record');
-- Scoped authority cannot escape to a global queue or another election.
insert into public.committee_members(user_id,role,election_id) values('86000000-0000-4000-8000-000000000003','verification_officer','86200000-0000-4000-8000-000000000001');
set local request.jwt.claim.sub='86000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"session_id":"86000000-0000-4000-8000-000000000003"}';
set local role authenticated;
select throws_ok($$select public.review_verification_queue()$$,'P0001',null,'scoped verifier cannot access global identity queue');
select throws_ok($$select public.bulk_decide_election_eligibility('86200000-0000-4000-8000-000000000002',array['86000000-0000-4000-8000-000000000004']::uuid[],'verified','')$$,'P0001',null,'scoped verifier cannot grant eligibility in other election');
reset role;
select * from finish();
rollback;
