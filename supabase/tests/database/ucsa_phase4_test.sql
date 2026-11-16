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

select plan(43);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('64000000-0000-4000-8000-000000000001','authenticated','authenticated','p4-student@test.ucsa.invalid','',now(),'{}','{}',now(),now()),
 ('64000000-0000-4000-8000-000000000002','authenticated','authenticated','p4-other@test.ucsa.invalid','',now(),'{}','{}',now(),now()),
 ('64000000-0000-4000-8000-000000000003','authenticated','authenticated','p4-chair@test.ucsa.invalid','',now(),'{}','{}',now(),now()),
 ('64000000-0000-4000-8000-000000000004','authenticated','authenticated','p4-certifier@test.ucsa.invalid','',now(),'{}','{}',now(),now());
update public.profiles set verification_status='verified' where id in ('64000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000003','64000000-0000-4000-8000-000000000004');
update public.profiles set full_name=case id when '64000000-0000-4000-8000-000000000001' then 'Synthetic Candidate One' when '64000000-0000-4000-8000-000000000002' then 'Synthetic Candidate Two' else 'Synthetic Committee Officer' end where id in ('64000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000003','64000000-0000-4000-8000-000000000004');
insert into public.committee_members(user_id,role,election_id) values
 ('64000000-0000-4000-8000-000000000003','committee_chair',null),
 ('64000000-0000-4000-8000-000000000004','certifying_officer',null),
 ('64000000-0000-4000-8000-000000000002','election_administrator',null);
insert into public.elections(id,title,description,nominations_start,nominations_end,voting_start,voting_end,status,created_by)
values('65000000-0000-4000-8000-000000000001','Synthetic Phase 4 election','Disposable local PostgreSQL integration fixture',now()-interval '4 days',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day','prepared','64000000-0000-4000-8000-000000000003');
insert into public.election_offices(id,election_id,title,display_order,is_active) values
 ('66000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','President',0,true),
 ('66000000-0000-4000-8000-000000000002','65000000-0000-4000-8000-000000000001','Secretary',1,true),
 ('66000000-0000-4000-8000-000000000003','65000000-0000-4000-8000-000000000001','Treasurer',2,true);
insert into public.candidate_applications(id,election_id,office_id,user_id,status,submitted_at,biography,manifesto) values
 ('67000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','approved',now(),repeat('b',30),repeat('m',80)),
 ('67000000-0000-4000-8000-000000000002','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002','approved',now(),repeat('b',30),repeat('m',80)),
 ('67000000-0000-4000-8000-000000000003','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000002','approved',now(),repeat('b',30),repeat('m',80)),
 ('67000000-0000-4000-8000-000000000004','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000003','64000000-0000-4000-8000-000000000001','approved',now(),repeat('b',30),repeat('m',80)),
 ('67000000-0000-4000-8000-000000000005','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000003','64000000-0000-4000-8000-000000000002','approved',now(),repeat('b',30),repeat('m',80)),
 ('67000000-0000-4000-8000-000000000006','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000003','approved',now(),repeat('b',30),repeat('m',80));
update public.elections set status='closed' where id='65000000-0000-4000-8000-000000000001';
insert into public.vote_participation(election_id,office_id,user_id) values
 ('65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001'),
 ('65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000001'),
 ('65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002');
insert into public.anonymous_ballots(election_id,office_id,candidate_application_id) values
 ('65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000001'),
 ('65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000002'),
 ('65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','67000000-0000-4000-8000-000000000003');

select ok(not has_table_privilege('authenticated','public.anonymous_ballots','select'),'ordinary authenticated users cannot read ballots');
select ok(not has_table_privilege('authenticated','public.election_certifications','select'),'certifications are not directly readable');
select ok(not has_table_privilege('anon','public.complaints','select'),'public users cannot query complaints');

insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where id in('64000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000003','64000000-0000-4000-8000-000000000004');


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
set local request.jwt.claim.sub='64000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"64000000-0000-4000-8000-000000000001"}';
select is(public.submit_complaint('65000000-0000-4000-8000-000000000001','election_process','Synthetic complaint for a private local integration test.'::text)->>'status','submitted','verified student can submit a complaint');
select is((select count(*)::integer from public.complaints),1,'student can see their own complaint only');
select is((select count(*)::integer from public.complaint_events),1,'student can see public history for their own case');
select is((select count(*)::integer from public.list_committee_complaints(null)),0,'student cannot list confidential committee cases');
reset role;
select set_config('test.phase4_complaint_id',(select id::text from public.complaints limit 1),true);
insert into public.complaint_documents(id,complaint_id,storage_path,file_name,mime_type,byte_size,uploaded_by)
select '68000000-0000-4000-8000-000000000001',c.id,c.student_id::text||'/'||c.id::text||'/fixture.pdf','fixture.pdf','application/pdf',12,c.student_id from public.complaints c limit 1;
insert into storage.objects(bucket_id,name)
select 'complaint-private',storage_path from public.complaint_documents where id='68000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='64000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"64000000-0000-4000-8000-000000000001"}';
select is((select count(*)::integer from storage.objects where bucket_id='complaint-private'),0,'student cannot directly read private evidence objects');
select matches(public.get_complaint_document_path(current_setting('test.phase4_complaint_id')::uuid,'68000000-0000-4000-8000-000000000001'),'^64000000-0000-4000-8000-000000000001/'||current_setting('test.phase4_complaint_id')||'/fixture[.]pdf$','owner resolves evidence only through the protected path RPC');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='64000000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"session_id":"64000000-0000-4000-8000-000000000002"}';
select is((select count(*)::integer from public.complaints),0,'student cannot see another student complaint');
select is((select count(*)::integer from public.complaint_events),0,'student cannot read another case history');
select throws_ok($$select public.get_certification_workspace('65000000-0000-4000-8000-000000000001')$$,'P0001',null,'election administrator cannot read certifier-only candidate totals');
select throws_ok($$select public.get_complaint_document_path(current_setting('test.phase4_complaint_id')::uuid,'68000000-0000-4000-8000-000000000001')$$,'P0001',null,'student cannot resolve another student evidence path');
reset role;
set local role authenticated;
reset request.jwt.claim.sub;
select throws_ok($$select public.get_complaint_details(current_setting('test.phase4_complaint_id')::uuid)$$,'P0001',null,'authenticated session without a user id cannot read complaint details');
select throws_ok($$select public.get_complaint_document_path(current_setting('test.phase4_complaint_id')::uuid,'68000000-0000-4000-8000-000000000001')$$,'P0001',null,'authenticated session without a user id cannot resolve evidence paths');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='64000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"session_id":"64000000-0000-4000-8000-000000000003"}';
select lives_ok($$select public.review_complaint((select id from public.complaints limit 1),'resolved','Reviewed under synthetic fixture policy','Internal note')$$,'authorized chair can resolve complaint with public and internal notes');
select lives_ok($$select public.configure_election_certification_policy('65000000-0000-4000-8000-000000000001',1::smallint,'Synthetic policy reference for local test',true,false)$$,'chair can configure an explicit policy');
select is(public.get_published_election_results('65000000-0000-4000-8000-000000000001'),null::jsonb,'uncertified results are not public');
select throws_ok($$select public.certify_election_results('65000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000099')$$,'P0001',null,'certification cannot use missing reconciliation');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='64000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"64000000-0000-4000-8000-000000000004"}';
select is(public.reconcile_election_results('65000000-0000-4000-8000-000000000001')->>'status','passed','authorized reviewer reconciles after election close');
select throws_ok($$select count(*) from public.anonymous_ballots$$,'42501',null,'committee reviewer cannot query individual ballot selections');
select lives_ok($$select public.record_certification_approval('65000000-0000-4000-8000-000000000001',(public.get_certification_workspace('65000000-0000-4000-8000-000000000001')->'reconciliation'->>'id')::uuid,'approved','Synthetic test approval')$$,'authorized reviewer can approve reconciled snapshot');
reset role;
select ok(exists(select 1 from public.admin_audit_events where action='complaint_submitted' and entity_type='complaint'),'complaint submission creates an audit record');
select is((select count(*)::integer from public.election_reconciliations),1,'reconciliation record is created');
select is((select count(*)::integer from public.election_reconciliation_offices),3,'reconciliation covers every active office');
select is((select count(*)::integer from public.election_candidate_snapshots),6,'approved candidates with zero votes remain in the result');
select is((select vote_count from public.election_candidate_snapshots where candidate_application_id='67000000-0000-4000-8000-000000000001'),1::bigint,'candidate vote count is database-derived');
select is((select vote_count from public.election_candidate_snapshots where candidate_application_id='67000000-0000-4000-8000-000000000002'),1::bigint,'second selected candidate vote is counted');
select is((select vote_count from public.election_candidate_snapshots where candidate_application_id='67000000-0000-4000-8000-000000000006'),0::bigint,'zero-vote approved candidate is represented');
select ok((select bool_and(tied_at_top) from public.election_candidate_snapshots where candidate_application_id in('67000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000002')),'equal top vote totals are marked as a tie');
select is((select percentage from public.election_candidate_snapshots where candidate_application_id='67000000-0000-4000-8000-000000000004'),0::numeric,'zero turnout percentage is zero');
select ok(not (select tied_at_top from public.election_candidate_snapshots where candidate_application_id='67000000-0000-4000-8000-000000000004'),'zero turnout is not described as a top tie');

set local role authenticated;
set local request.jwt.claim.sub='64000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"session_id":"64000000-0000-4000-8000-000000000003"}';
select throws_ok($$select public.configure_election_certification_policy('65000000-0000-4000-8000-000000000001',2::smallint,'Changed synthetic policy after reconciliation',true,false)$$,'P0001',null,'certification policy freezes once reconciliation begins');
select is(public.certify_election_results('65000000-0000-4000-8000-000000000001',(public.get_certification_workspace('65000000-0000-4000-8000-000000000001')->'reconciliation'->>'id')::uuid)->>'reference' is not null,true,'chair certifies after reconciliation and required approval');
select is((select status::text from public.elections where id='65000000-0000-4000-8000-000000000001'),'certified','certification updates election lifecycle');
select is((select withheld from public.get_election_participation_summary('65000000-0000-4000-8000-000000000001')),true,'certified election participation report retains small-cohort suppression');
select throws_ok($$update public.election_certifications set certification_reference='tampered'$$,'42501',null,'authenticated role cannot modify certified snapshots');
select lives_ok($$select public.publish_certified_election_results('65000000-0000-4000-8000-000000000001',(public.get_certification_workspace('65000000-0000-4000-8000-000000000001')->'certifications'->0->>'id')::uuid,'Published by synthetic local test')$$,'chair publishes certified results');
select is(public.publish_certified_election_results('65000000-0000-4000-8000-000000000001',(public.get_certification_workspace('65000000-0000-4000-8000-000000000001')->'certifications'->0->>'id')::uuid,'Retry')->>'version','1','publication replay returns the original version');
select matches(public.get_rehearsal_results('65000000-0000-4000-8000-000000000001')->>'certificationReference','^UCSA-CERT-[0-9]{4}-[A-F0-9]{8}$','authorized rehearsal RPC exposes certified result after publication');
reset role;
select is(public.get_rehearsal_results('65000000-0000-4000-8000-000000000001')->'election',(select result_snapshot from public.election_certifications where election_id='65000000-0000-4000-8000-000000000001'),'published result equals the complete certified snapshot');
select is((select snapshot_sha256 from public.election_certifications where election_id='65000000-0000-4000-8000-000000000001'),(select encode(extensions.digest(convert_to(result_snapshot::text,'UTF8'),'sha256'),'hex') from public.election_certifications where election_id='65000000-0000-4000-8000-000000000001'),'certification digest matches stored snapshot bytes');
set local role anon;
select is(public.get_published_election_results('65000000-0000-4000-8000-000000000001'),null::jsonb,'anonymous role cannot receive synthetic rehearsal results');
select * from finish();
reset role;
rollback;
