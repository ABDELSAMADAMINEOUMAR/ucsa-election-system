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

select plan(47);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('60000000-0000-4000-8000-000000000001','authenticated','authenticated','voter@test.ucsa.invalid','',now(),'{}','{}',now(),now()),
 ('60000000-0000-4000-8000-000000000002','authenticated','authenticated','unverified@test.ucsa.invalid','',now(),'{}','{}',now(),now()),
 ('60000000-0000-4000-8000-000000000003','authenticated','authenticated','admin@test.ucsa.invalid','',now(),'{}','{}',now(),now()),
 ('60000000-0000-4000-8000-000000000004','authenticated','authenticated','candidate@test.ucsa.invalid','',now(),'{}','{}',now(),now()),
 ('60000000-0000-4000-8000-000000000005','authenticated','authenticated','suspended@test.ucsa.invalid','',now(),'{}','{}',now(),now());
update public.profiles set verification_status='verified' where id in ('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000005');
update auth.users set banned_until=now()+interval '1 day' where id='60000000-0000-4000-8000-000000000005';
insert into public.committee_members(user_id,role,election_id) values
 ('60000000-0000-4000-8000-000000000003','election_administrator',null),
 ('60000000-0000-4000-8000-000000000003','certifying_officer',null),
 ('60000000-0000-4000-8000-000000000004','candidate_review_officer',null),
 ('60000000-0000-4000-8000-000000000005','election_administrator',null);
insert into public.elections(id,title,description,nominations_start,nominations_end,voting_start,voting_end,status,created_by)
values('61000000-0000-4000-8000-000000000001','Synthetic voting test','Local disposable test only',now()-interval '2 days',now()-interval '1 day',now()-interval '1 hour',now()+interval '1 hour','prepared','60000000-0000-4000-8000-000000000003'),
 ('61000000-0000-4000-8000-000000000002','Closed synthetic election','Local disposable test only',now()-interval '3 days',now()-interval '2 days',now()-interval '2 hours',now()-interval '1 hour','prepared','60000000-0000-4000-8000-000000000003'),
 ('61000000-0000-4000-8000-000000000003','Future synthetic election','Local disposable test only',now()-interval '2 days',now()-interval '1 day',now()+interval '1 hour',now()+interval '2 hours','prepared','60000000-0000-4000-8000-000000000003'),
 ('61000000-0000-4000-8000-000000000004','Expired window synthetic election','Local disposable test only',now()-interval '4 days',now()-interval '3 days',now()-interval '2 hours',now()-interval '1 hour','prepared','60000000-0000-4000-8000-000000000003');
insert into public.election_offices(id,election_id,title,display_order) values
 ('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','President',0),
 ('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','Secretary',1),
 ('62000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000002','President',0),
 ('62000000-0000-4000-8000-000000000004','61000000-0000-4000-8000-000000000003','President',0),
 ('62000000-0000-4000-8000-000000000005','61000000-0000-4000-8000-000000000004','President',0);
insert into public.election_eligibility(election_id,user_id,status,decided_by,decided_at) values
 ('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','verified','60000000-0000-4000-8000-000000000003',now()),
 ('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','verified','60000000-0000-4000-8000-000000000003',now()),
 ('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003','verified','60000000-0000-4000-8000-000000000003',now()),
 ('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000005','verified','60000000-0000-4000-8000-000000000003',now()),
 ('61000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000001','verified','60000000-0000-4000-8000-000000000003',now()),
 ('61000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000001','verified','60000000-0000-4000-8000-000000000003',now());
insert into public.candidate_applications(id,election_id,office_id,user_id,status,submitted_at,biography,manifesto) values
 ('63000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000004','approved',now(),repeat('b',30),repeat('m',80)),
 ('63000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000004','approved',now(),repeat('b',30),repeat('m',80)),
 ('63000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000003','submitted',now(),repeat('b',30),repeat('m',80)),
 ('63000000-0000-4000-8000-000000000004','61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000004','approved',now(),repeat('b',30),repeat('m',80)),
 ('63000000-0000-4000-8000-000000000005','61000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000004','approved',now(),repeat('b',30),repeat('m',80)),
 ('63000000-0000-4000-8000-000000000006','61000000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000004','approved',now(),repeat('b',30),repeat('m',80));
update public.elections set status='open' where id in ('61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000004');
update public.elections set status='closed' where id='61000000-0000-4000-8000-000000000002';

insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from auth.users where id in('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000005');

-- Inject a failure at ballot insertion, AFTER participation has been written.
-- This additional rollback-only trigger never changes an application control.
create function public.phase5_ballot_fault() returns trigger language plpgsql as $$
begin raise exception 'Synthetic ballot write failure'; end $$;
create trigger phase5_ballot_fault before insert on public.anonymous_ballots for each row execute function public.phase5_ballot_fault();

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
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"60000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')$$,'P0001','Synthetic ballot write failure','failure during ballot insertion propagates');
reset role;
select is((select count(*) from public.vote_participation where election_id='61000000-0000-4000-8000-000000000001'),0::bigint,'write failure rolls back prior participation insertions');
select is((select count(*) from public.anonymous_ballots where election_id='61000000-0000-4000-8000-000000000001'),0::bigint,'write failure leaves no partial ballot');
drop trigger phase5_ballot_fault on public.anonymous_ballots;
drop function public.phase5_ballot_fault();
set local role authenticated;
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"session_id":"60000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.get_open_ballot('61000000-0000-4000-8000-000000000001')$$,'eligible student can load the actual ballot');
select is(public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')->>'recorded','true','eligible authenticated student can submit an atomic multi-office ballot');
select is((select count(*) from public.vote_participation where user_id=auth.uid()),2::bigint,'successful submission records participation for every office');
select throws_ok($$select count(*) from public.anonymous_ballots$$,'42501',null,'student cannot read anonymous ballot rows');
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')$$,'P0001',null,'duplicate or replayed submission is rejected');
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000002','[{"office_id":"62000000-0000-4000-8000-000000000003","candidate_application_id":"63000000-0000-4000-8000-000000000004"}]')$$,'P0001',null,'closed election submission is rejected');
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000003','[{"office_id":"62000000-0000-4000-8000-000000000004","candidate_application_id":"63000000-0000-4000-8000-000000000005"}]')$$,'P0001',null,'submission before scheduled opening is rejected');
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000004','[{"office_id":"62000000-0000-4000-8000-000000000005","candidate_application_id":"63000000-0000-4000-8000-000000000006"}]')$$,'P0001',null,'open status does not allow submission after the scheduled end');
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000003"}]')$$,'P0001',null,'unapproved candidate is rejected');
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')$$,'P0001',null,'candidate selected for wrong office is rejected');
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','{}')$$,'P0001',null,'malformed ballot is rejected');
select is((select count(*) from public.vote_participation where user_id=auth.uid()),2::bigint,'failed ballots do not consume additional participation or leave partial records');
select throws_ok($$select count(*) from public.anonymous_ballots$$,'42501',null,'failed ballots do not expose ballot table to student');
select is((select count(*) from public.get_my_vote_status('61000000-0000-4000-8000-000000000001')),2::bigint,'retry status exposes only the students own office participation');
reset role;
select lives_ok($$update public.election_eligibility set status='revoked',decided_by='60000000-0000-4000-8000-000000000003',decided_at=now() where election_id='61000000-0000-4000-8000-000000000001' and user_id='60000000-0000-4000-8000-000000000005'$$,'security revocation remains possible while voting is open');
select throws_ok($$insert into public.election_eligibility(election_id,user_id,status,decided_by,decided_at) values('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000004','verified','60000000-0000-4000-8000-000000000003',now())$$,'P0001',null,'new eligibility grants are frozen while voting is open');
select is((select count(*) from public.anonymous_ballots where election_id='61000000-0000-4000-8000-000000000001'),2::bigint,'database owner can verify anonymous ballot rows after commit');
select throws_ok($$insert into public.vote_participation(election_id,office_id,user_id) values('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001')$$,'23505',null,'database uniqueness prevents a second successful participation for an office');

set local role authenticated;
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"session_id":"60000000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')$$,'P0001',null,'unverified account is rejected');
select is((select count(*) from public.vote_participation),0::bigint,'unverified student cannot see another account participation record');
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"60000000-0000-4000-8000-000000000004"}';
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')$$,'P0001',null,'verified student without election eligibility is rejected');
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000005';
set local request.jwt.claims='{"session_id":"60000000-0000-4000-8000-000000000005"}';
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')$$,'P0001',null,'suspended account is rejected');
select ok(not public.has_committee_role(array['election_administrator']::public.committee_role[]),'suspended committee account is rejected by the shared role guard');
select throws_ok($$select public.open_election('61000000-0000-4000-8000-000000000003')$$,'P0001',null,'suspended committee account cannot use election controls');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"60000000-0000-4000-8000-000000000004"}';
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')$$,'P0001',null,'committee role does not bypass election-specific student eligibility');
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"session_id":"60000000-0000-4000-8000-000000000003"}';
select throws_ok($$select public.get_closed_election_tally('61000000-0000-4000-8000-000000000001')$$,'P0001',null,'premature totals are inaccessible even to certifier');
select is((select count(*) from public.get_closed_election_tally('61000000-0000-4000-8000-000000000002')),1::bigint,'certifier can query candidate totals only for a closed election after its scheduled end');
select throws_ok($$select * from public.get_election_participation_summary('61000000-0000-4000-8000-000000000001')$$,'P0001',null,'live participation summary is not released');
select is((select withheld from public.get_election_participation_summary('61000000-0000-4000-8000-000000000002')),true,'small electorates receive withheld participation summary');
select throws_ok($$select public.open_election('61000000-0000-4000-8000-000000000003')$$,'P0001',null,'authorized administrator cannot open before the configured start');
select lives_ok($$select public.close_election('61000000-0000-4000-8000-000000000001')$$,'authorized administrator can close an open election');
select is((select status::text from public.elections where id='61000000-0000-4000-8000-000000000001'),'closed','close control changes election lifecycle state');
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]')$$,'P0001',null,'closed election rejects submission after lifecycle transition');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"session_id":"60000000-0000-4000-8000-000000000004"}';
select throws_ok($$select public.get_closed_election_tally('61000000-0000-4000-8000-000000000002')$$,'P0001',null,'candidate reviewer cannot query ballot totals');
select throws_ok($$select count(*) from public.anonymous_ballots$$,'42501',null,'committee and candidate roles cannot directly read ballots');
select throws_ok($$insert into public.anonymous_ballots(election_id,office_id,candidate_application_id) values('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001')$$,'42501',null,'authenticated role cannot insert ballot rows directly');
select throws_ok($$update public.anonymous_ballots set candidate_application_id='63000000-0000-4000-8000-000000000001'$$,'42501',null,'authenticated role cannot modify ballot rows');
select throws_ok($$delete from public.anonymous_ballots$$,'42501',null,'authenticated role cannot delete ballot rows');
reset role;

set local role anon;
select throws_ok($$select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[]')$$,'42501',null,'anonymous role cannot call submission RPC');
reset role;
select ok(not has_table_privilege('authenticated','public.anonymous_ballots','select'),'no authenticated SELECT privilege exists on anonymous ballots');
select ok(not has_table_privilege('authenticated','public.anonymous_ballots','insert'),'no authenticated INSERT privilege exists on anonymous ballots');
select ok(not has_table_privilege('authenticated','public.anonymous_ballots','update'),'no authenticated UPDATE privilege exists on anonymous ballots');
select ok(not has_table_privilege('authenticated','public.anonymous_ballots','delete'),'no authenticated DELETE privilege exists on anonymous ballots');
select is((select count(*) from public.admin_audit_events where entity_type in('vote','ballot'))::bigint,0::bigint,'vote choices are never represented in audit events');
select * from finish();
rollback;
