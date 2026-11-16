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

select no_plan();
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('75000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','phase5-'||n||'@example.test',now(),'{}','{}',now(),now() from generate_series(1,5) n;
update public.profiles set verification_status='verified', full_name='Synthetic Phase 5 Student' where id::text like '75000000-%';
insert into public.elections(id,title,nominations_start,nominations_end,voting_start,voting_end,status,created_by)
values ('75100000-0000-4000-8000-000000000001','Phase 5 synthetic election',now()-interval '4 days',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day','prepared','75000000-0000-4000-8000-000000000001');
insert into public.election_offices(id,election_id,title,display_order) values ('75200000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000001','President',0);
insert into public.committee_members(user_id,role,election_id) values
('75000000-0000-4000-8000-000000000001','committee_chair',null),
('75000000-0000-4000-8000-000000000002','committee_chair','75100000-0000-4000-8000-000000000001'),
('75000000-0000-4000-8000-000000000003','candidate_review_officer','75100000-0000-4000-8000-000000000001'),
('75000000-0000-4000-8000-000000000004','certifying_officer','75100000-0000-4000-8000-000000000001');
insert into public.candidate_applications(id,election_id,office_id,user_id,status,submitted_at,biography,manifesto)
values ('75300000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000003','submitted',now(),repeat('b',30),repeat('m',80));
insert into public.candidate_applications(id,election_id,office_id,user_id,status,submitted_at,biography,manifesto)
values ('75300000-0000-4000-8000-000000000002','75100000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000005','submitted',now(),repeat('b',30),repeat('m',80));

insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where id::text like '75000000-%';


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
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000002"}';
select ok(public.has_committee_role(array['committee_chair']::public.committee_role[],'75100000-0000-4000-8000-000000000001'),'scoped chair retains assigned election access');
select ok(not public.has_committee_role(array['committee_chair']::public.committee_role[]),'scoped chair has no global authority');
select ok(not public.has_committee_role(array['committee_chair']::public.committee_role[],'75100000-0000-4000-8000-000000000099'),'scoped chair cannot access another election');
select throws_ok($$select public.manage_committee_member('75000000-0000-4000-8000-000000000005','verification_officer',null,'add')$$,'P0001',null,'scoped chair cannot grant global committee authority');
select throws_ok($$select public.import_eligible_students('[{"registration_number":"PHASE5-ESCALATE","email":"phase5-escape@example.test","status":"approved"}]')$$,'P0001',null,'scoped chair cannot change global identity roster');
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000003"}';
select throws_ok($$select public.decide_candidate_application('75300000-0000-4000-8000-000000000001','approved','Self review attempt')$$,'P0001',null,'reviewer cannot approve own application');
reset role;
update public.candidate_applications set status='submitted' where id='75300000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.decide_candidate_application('75300000-0000-4000-8000-000000000001','approved','Independent review')$$,'independent authorized reviewer can approve');
select lives_ok($$select public.configure_election_certification_policy('75100000-0000-4000-8000-000000000001',1::smallint,'Phase 5 synthetic policy',true,false)$$,'global chair can configure election policy');
reset role;
update public.elections set status='closed' where id='75100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000005';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000005"}';
select is(public.submit_complaint('75100000-0000-4000-8000-000000000001','other','Synthetic complaint for Phase 5 evidence validation')->>'status','submitted','verified student submits synthetic complaint');
reset role;
select set_config('test.phase5_complaint',(select id::text from public.complaints where election_id='75100000-0000-4000-8000-000000000001'),true);
set local role authenticated;
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000005';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000005"}';
select throws_ok($$select public.record_complaint_document(current_setting('test.phase5_complaint')::uuid,'75000000-0000-4000-8000-000000000005/'||current_setting('test.phase5_complaint')||'/75400000-0000-4000-8000-000000000001.pdf','forged.pdf','application/pdf',12)$$,'42501',null,'student cannot invent evidence metadata without a stored object');
select throws_ok($$select public.review_complaint(current_setting('test.phase5_complaint')::uuid,'resolved','Self decision')$$,'P0001',null,'student cannot resolve own complaint');
select throws_ok($$select public.reconcile_election_results('75100000-0000-4000-8000-000000000001')$$,'P0001',null,'student cannot tally');
select throws_ok($$select public.certify_election_results('75100000-0000-4000-8000-000000000001',gen_random_uuid())$$,'P0001',null,'student cannot certify');
select throws_ok($$select public.publish_certified_election_results('75100000-0000-4000-8000-000000000001',gen_random_uuid(),'')$$,'P0001',null,'student cannot publish');
select throws_ok($$update public.admin_audit_events set reason='tamper'$$,'42501',null,'student cannot modify audit history');
select throws_ok($$delete from public.anonymous_ballots$$,'42501',null,'student cannot delete ballots');
reset role;
set local role service_role;
select throws_ok($$select public.record_complaint_document(current_setting('test.phase5_complaint')::uuid,'75000000-0000-4000-8000-000000000005/'||current_setting('test.phase5_complaint')||'/75400000-0000-4000-8000-000000000001.pdf','missing.pdf','application/pdf',12)$$,'P0001',null,'server cannot finalize an evidence object that is missing');
reset role;
insert into storage.objects(bucket_id,name) values('complaint-private','75000000-0000-4000-8000-000000000005/'||current_setting('test.phase5_complaint')||'/75400000-0000-4000-8000-000000000001.pdf');
set local role service_role;
select lives_ok($$select public.record_complaint_document(current_setting('test.phase5_complaint')::uuid,'75000000-0000-4000-8000-000000000005/'||current_setting('test.phase5_complaint')||'/75400000-0000-4000-8000-000000000001.pdf','stored.pdf','application/pdf',12)$$,'trusted server can finalize stored synthetic evidence');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.review_complaint(current_setting('test.phase5_complaint')::uuid,'resolved','Synthetic evidence test complete')$$,'chair resolves synthetic complaint');
select is(public.reconcile_election_results('75100000-0000-4000-8000-000000000001')->>'status','passed','zero turnout reconciliation passes with zero totals');
reset role;
select set_config('test.phase5_reconciliation',(select id::text from public.election_reconciliations where election_id='75100000-0000-4000-8000-000000000001'),true);
set local role authenticated;
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000004"}';
select lives_ok($$select public.record_certification_approval('75100000-0000-4000-8000-000000000001',current_setting('test.phase5_reconciliation')::uuid,'approved','Synthetic approval')$$,'active scoped officer approves');
select throws_ok($$select public.record_certification_approval('75100000-0000-4000-8000-000000000001',current_setting('test.phase5_reconciliation')::uuid,'approved','Replay')$$,'23505',null,'approval replay is rejected');
reset role;
delete from public.committee_members where user_id='75000000-0000-4000-8000-000000000004';
set local role authenticated;
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000004"}';
select ok(not public.has_committee_role(array['certifying_officer']::public.committee_role[],'75100000-0000-4000-8000-000000000001'),'removed committee membership loses authority immediately');
select throws_ok($$select public.get_certification_workspace('75100000-0000-4000-8000-000000000001')$$,'P0001',null,'removed officer cannot read confidential results');
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.certify_election_results('75100000-0000-4000-8000-000000000001',current_setting('test.phase5_reconciliation')::uuid)$$,'P0001',null,'revoked officer approval cannot satisfy quorum');
reset role;
-- Owner-only fault fixtures represent inconsistent imported/tampered records;
-- ordinary callers have no permission to perform these writes.
insert into public.anonymous_ballots(election_id,office_id,candidate_application_id)
values('75100000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','75300000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.reconcile_election_results('75100000-0000-4000-8000-000000000001')->>'status','discrepancy','unbalanced ballot and participation totals fail reconciliation');
reset role;
insert into public.vote_participation(election_id,office_id,user_id)
values('75100000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000005');
update public.anonymous_ballots set candidate_application_id='75300000-0000-4000-8000-000000000002' where election_id='75100000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.reconcile_election_results('75100000-0000-4000-8000-000000000001')->>'invalidTotal','1','balanced totals still identify a ballot for an unapproved candidate');
select is(jsonb_array_length(public.get_certification_workspace('75100000-0000-4000-8000-000000000001')->'reconciliation'->'candidates'),0,'a failed reconciliation produces no candidate result snapshot');
select throws_ok($$select public.record_certification_approval('75100000-0000-4000-8000-000000000001',(public.get_certification_workspace('75100000-0000-4000-8000-000000000001')->'reconciliation'->>'id')::uuid,'approved','Attempt to approve discrepancies')$$,'P0001',null,'discrepancy reconciliation cannot receive a certification approval');
reset role;
insert into public.complaints(election_id,student_id,category,description,status,reference_code)
select '75100000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000005','other','Synthetic bounded large complaint report fixture','resolved','P5-BULK-'||n from generate_series(1,1001) n;
set local role authenticated;
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000001"}';
select is((select sum(case_count) from public.get_election_complaint_summary('75100000-0000-4000-8000-000000000001')),1002::numeric,'aggregate report counts all cases beyond the REST row cap');
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000005';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000005"}';
select throws_ok($$select * from public.get_election_complaint_summary('75100000-0000-4000-8000-000000000001')$$,'P0001',null,'student cannot retrieve confidential complaint aggregates');
reset role;
select throws_ok($$update public.profiles set full_name='' where id='75000000-0000-4000-8000-000000000003'$$,'P0001',null,'approved candidate cannot erase identity and break reconciliation');
select throws_ok($$update public.profiles set full_name='Changed identity' where id='75000000-0000-4000-8000-000000000003'$$,'P0001',null,'candidate identity remains frozen after voting');
delete from auth.sessions where id='75000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='75000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"75000000-0000-4000-8000-000000000001"}';
select ok(not public.is_active_session(),'deleted session fails live-session verification');
select is((select count(*) from public.profiles),0::bigint,'old token cannot read even its own profile');
select throws_ok($$select public.get_complaint_details(current_setting('test.phase5_complaint')::uuid)$$,'P0001',null,'old token cannot call trusted complaint read RPC');
select throws_ok($$select public.submit_verification_request('PHASE5-OLD')$$,'P0001',null,'old token cannot mutate through trusted RPC');
reset role;
select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)),'all application tables enforce RLS');
select is((select provolatile::text from pg_proc where oid='public.get_election_complaint_summary(uuid)'::regprocedure),'v','clock-dependent complaint report is declared volatile');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not coalesce(p.proconfig,'{}') @> array['search_path=""']),'all public security definers use controlled empty search_path');
select ok(not has_table_privilege('anon','public.candidate_review_queue','SELECT'),'anonymous visitors have no review-view grant');
select ok(not has_table_privilege('authenticated','public.candidate_review_queue','INSERT,UPDATE,DELETE'),'authenticated clients have no review-view write grants');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype='trigger'::regtype and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),'trigger functions have no client execution grant');
create function public.phase5_default_probe() returns integer language sql as 'select 1';
select ok(not has_function_privilege('anon','public.phase5_default_probe()','EXECUTE') and not has_function_privilege('authenticated','public.phase5_default_probe()','EXECUTE'),'new functions do not inherit public client execution');
create table public.phase5_default_probe_table(id integer);
select ok(not has_table_privilege('anon','public.phase5_default_probe_table','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.phase5_default_probe_table','SELECT,INSERT,UPDATE,DELETE'),'new tables do not inherit client grants');
select * from finish();
rollback;
