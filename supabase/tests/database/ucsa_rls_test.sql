begin;
create extension if not exists pgtap with schema extensions;
-- Assertion helpers belong to the rollback-only test harness. Grant only
-- pgTAP extension functions, never application RPCs or table privileges.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_depend d on d.objid=p.oid and d.classid='pg_proc'::regclass
  join pg_extension e on e.oid=d.refobjid and d.refclassid='pg_extension'::regclass
  where e.extname='pgtap' and d.deptype='e'
 loop execute format('grant execute on function %s to anon,authenticated,service_role',f.signature); end loop;
end $$;

select plan(31);

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000001','authenticated','authenticated','one@test.ucsa.invalid','',now(),'{}','{"full_name":"Student One"}',now(),now()),
 ('00000000-0000-4000-8000-000000000002','authenticated','authenticated','two@test.ucsa.invalid','',now(),'{}','{"full_name":"Student Two"}',now(),now()),
 ('00000000-0000-4000-8000-000000000003','authenticated','authenticated','verify@test.ucsa.invalid','',now(),'{}','{"full_name":"Verifier"}',now(),now()),
 ('00000000-0000-4000-8000-000000000004','authenticated','authenticated','review@test.ucsa.invalid','',now(),'{}','{"full_name":"Reviewer"}',now(),now());
insert into public.committee_members(user_id,role,election_id) values
 ('00000000-0000-4000-8000-000000000003','verification_officer',null),
 ('00000000-0000-4000-8000-000000000004','candidate_review_officer',null);
insert into public.eligible_students(registration_number,verified_email) values
 ('REG-TEST-001','one@test.ucsa.invalid'),('REG-TEST-002','two@test.ucsa.invalid');
update public.profiles set registration_number='REG-TEST-001',verification_status='verified' where id='00000000-0000-4000-8000-000000000001';
insert into public.elections(id,title,nominations_start,nominations_end,voting_start,voting_end,created_by)
values('10000000-0000-4000-8000-000000000001','Test UCSA Election',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days','00000000-0000-4000-8000-000000000003');
insert into public.election_offices(id,election_id,title,display_order)
values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','President',0),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Vice President',1);
insert into public.election_eligibility(election_id,user_id,status,decided_by,decided_at)
values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','verified','00000000-0000-4000-8000-000000000003',now());
select throws_ok($$insert into public.election_eligibility(election_id,user_id,status,decided_by,decided_at) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','verified','00000000-0000-4000-8000-000000000003',now())$$,'23505',null,'a voter has one unique eligibility record per election');
insert into public.student_verification_requests(id,user_id,requested_registration_number)
values('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','REG-TEST-002');
select is((select public from storage.buckets where id='candidate-private'),false,'candidate photos are stored in a private bucket');

insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where id in('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004');


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
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"00000000-0000-4000-8000-000000000001"}';
select is((select count(*) from public.profiles),1::bigint,'student sees only own profile');
select is((select count(*) from public.profiles where id='00000000-0000-4000-8000-000000000002'),0::bigint,'student cannot read another profile');
select is((select count(*) from public.eligible_students),0::bigint,'student cannot see the identity roster');
select ok(not has_table_privilege('authenticated','public.committee_members','insert'),'student cannot assign a committee role');
select is((select count(*) from public.committee_members),0::bigint,'student cannot read committee members');
select throws_ok($$insert into storage.objects(bucket_id,name) values('candidate-private','00000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/unauthorized.webp')$$,'42501',null,'student cannot upload directly into private storage');
select throws_ok($$insert into public.candidate_applications(election_id,office_id,user_id,status,submitted_at,biography,manifesto)
 values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','submitted',now(),repeat('a',30),repeat('b',80))$$,'42501',null,'student must submit a draft before a controlled transition');
insert into public.candidate_applications(election_id,office_id,user_id,status,biography,manifesto)
values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','draft',repeat('a',30),repeat('b',80));
select lives_ok($$select public.submit_candidate_application((select id from public.candidate_applications where user_id=auth.uid()))$$,'authorized student can submit eligible application atomically');
select is((select status::text from public.candidate_applications where user_id='00000000-0000-4000-8000-000000000001'),'submitted','application is submitted');
reset role;
select ok(exists(select 1 from public.admin_audit_events where action='submitted' and entity_type='candidate_application'),'submission creates audit entry');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"00000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.submit_candidate_application((select id from public.candidate_applications where user_id=auth.uid()))$$,'P0001',null,'duplicate submission is rejected');

set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"session_id":"00000000-0000-4000-8000-000000000003"}';
select throws_ok($$select public.decide_candidate_application((select id from public.candidate_applications where user_id='00000000-0000-4000-8000-000000000001'),'approved','')$$,'P0001',null,'verification officer cannot review candidacy');
select lives_ok($$select public.decide_student_verification('30000000-0000-4000-8000-000000000001','verified','Roster match confirmed')$$,'verification officer may confirm exact approved roster match');
select is((select verification_status::text from public.profiles where id='00000000-0000-4000-8000-000000000002'),'verified','committee decision marks verified profile');
select ok(exists(select 1 from public.verification_history where user_id='00000000-0000-4000-8000-000000000002' and reviewer_id='00000000-0000-4000-8000-000000000003'),'verification decision records reviewer history');
reset role;
insert into public.election_eligibility(election_id,user_id,status,decided_by,decided_at) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','verified','00000000-0000-4000-8000-000000000003',now());
insert into public.candidate_applications(id,election_id,office_id,user_id,biography,manifesto,status,submitted_at)
values('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',repeat('a',30),repeat('b',80),'submitted',now());
insert into storage.objects(bucket_id,name) values('candidate-private','00000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000002/photo.webp');
select ok(exists(select 1 from public.admin_audit_events where entity_type='student_verification_request'),'verification decision creates audit event');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"session_id":"00000000-0000-4000-8000-000000000003"}';
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"00000000-0000-4000-8000-000000000001"}';
select is((select count(*) from storage.objects where bucket_id='candidate-private' and name='00000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000002/photo.webp'),0::bigint,'student cannot read another applicant private photo');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"session_id":"00000000-0000-4000-8000-000000000002"}';
select is((select count(*) from storage.objects where bucket_id='candidate-private' and name='00000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000002/photo.webp'),1::bigint,'applicant can read their own private photo');

set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"00000000-0000-4000-8000-000000000004"}';
select is((select count(*) from public.student_verification_requests),0::bigint,'candidate reviewer cannot access verification records');
select lives_ok($$select public.decide_candidate_application((select id from public.candidate_applications where user_id='00000000-0000-4000-8000-000000000001'),'approved','')$$,'candidate reviewer can approve submitted application');
select is((select status::text from public.candidate_applications where user_id='00000000-0000-4000-8000-000000000001'),'approved','candidate application records approval');

reset role;
insert into public.candidate_applications(election_id,office_id,user_id,biography,manifesto,status,submitted_at)
values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',repeat('a',30),repeat('b',80),'submitted',now());
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"00000000-0000-4000-8000-000000000004"}';
select lives_ok($$select public.decide_candidate_application((select id from public.candidate_applications where office_id='20000000-0000-4000-8000-000000000002'),'rejected','Eligibility document is incomplete')$$,'candidate reviewer can reject with a reason');
select is((select status::text from public.candidate_applications where office_id='20000000-0000-4000-8000-000000000002'),'rejected','rejection updates application status');
select is((select reason from public.candidate_review_decisions where application_id=(select id from public.candidate_applications where office_id='20000000-0000-4000-8000-000000000002')),'Eligibility document is incomplete','review decision preserves its reason');

reset role;
update auth.users set email='two-updated@test.ucsa.invalid' where id='00000000-0000-4000-8000-000000000002';
select is((select verification_status::text from public.profiles where id='00000000-0000-4000-8000-000000000002'),'revoked','confirmed email changes revoke global identity verification');
select is((select status::text from public.student_verification_requests where user_id='00000000-0000-4000-8000-000000000002'),'revoked','confirmed email changes revoke the prior verification request');
select is((select status::text from public.election_eligibility where user_id='00000000-0000-4000-8000-000000000002'),'revoked','confirmed email changes revoke election-scoped eligibility');
select is((select count(*) from public.verification_history where user_id='00000000-0000-4000-8000-000000000002' and status='revoked' and reviewer_id is null),1::bigint,'system revocation is recorded without impersonating a human reviewer');
select ok(exists(select 1 from public.admin_audit_events where action='auth_email_changed' and actor_id is null),'email-trigger revocation adds a system audit event');

select * from finish();
rollback;



