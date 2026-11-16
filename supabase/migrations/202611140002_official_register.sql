-- Approved LOCAL authorization upgrade. Existing records are never backfilled,
-- promoted, classified, deleted or reset. Official election operation stays closed.
create table public.official_registers (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 5 and 120),
 classification text not null check(classification in ('synthetic','official')),
 status text not null default 'staging' check(status in ('staging','locked','rejected')),
 parent_id uuid references public.official_registers(id), reason text not null default '',
 membership_opens timestamptz not null, membership_closes timestamptz not null,
 activation_opens timestamptz not null, activation_closes timestamptz not null,
 file_name text not null check(length(file_name) between 1 and 120), source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 rows_snapshot jsonb not null check(jsonb_typeof(rows_snapshot)='array' and jsonb_array_length(rows_snapshot) between 1 and 5000),
 snapshot_sha256 text not null, request_key uuid not null, created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(), approved_by uuid references public.profiles(id), approved_at timestamptz,
 unique(created_by,request_key), check(membership_opens<membership_closes and activation_opens<activation_closes),
 check(status<>'locked' or (approved_by is not null and approved_at is not null))
);
create table public.voter_identities (
 id uuid primary key default gen_random_uuid(), status text not null default 'active' check(status in ('active','suspended','revoked')),
 created_at timestamptz not null default clock_timestamp()
);
create table public.voter_identifiers (
 kind text not null check(kind in ('registration','email')), value text not null, identity_id uuid not null references public.voter_identities(id),
 primary key(kind,value)
);
create index voter_identifiers_identity_idx on public.voter_identifiers(identity_id);
create table public.official_register_entries (
 register_id uuid not null references public.official_registers(id), identity_id uuid not null references public.voter_identities(id),
 registration_number text not null, email text not null, full_name text not null,
 primary key(register_id,identity_id), unique(register_id,registration_number), unique(register_id,email)
);
create table public.voter_bindings (
 user_id uuid primary key references public.profiles(id), identity_id uuid not null unique references public.voter_identities(id),
 register_id uuid not null references public.official_registers(id), proof_email text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.election_registers (
 election_id uuid primary key references public.elections(id), register_id uuid not null references public.official_registers(id),
 rule_reference text not null check(length(trim(rule_reference)) between 5 and 500),
 approved_by uuid not null references public.profiles(id), approved_at timestamptz not null default clock_timestamp(),
 unique(election_id,register_id)
);
create table public.register_election_decisions (
 election_id uuid not null, register_id uuid not null, identity_id uuid not null,
 included boolean not null, reason text not null default '',
 primary key(election_id,identity_id),
 foreign key(election_id,register_id) references public.election_registers(election_id,register_id),
 foreign key(register_id,identity_id) references public.official_register_entries(register_id,identity_id)
);
create table public.election_classifications (
 election_id uuid primary key references public.elections(id), classification text not null check(classification in ('synthetic','official')),
 classified_by uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp()
);
create table public.candidate_slates (
 election_id uuid primary key references public.elections(id), finalized_by uuid not null references public.profiles(id),
 finalized_at timestamptz not null default clock_timestamp(), candidate_ids uuid[] not null, snapshot_sha256 text not null
);
create table public.membership_support (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id), email text not null,
 message text not null check(length(trim(message)) between 10 and 2000), status text not null default 'pending' check(status in ('pending','reviewed','resolved','rejected')),
 response text not null default '', created_at timestamptz not null default clock_timestamp(), reviewed_by uuid references public.profiles(id)
);
create table public.public_request_limits (
 bucket text not null, key_hash text not null, window_start timestamptz not null,
 hits integer not null, primary key(bucket,key_hash,window_start)
);

-- Policies and grants are explicit: private register/source snapshots never go to students.
do $$ declare t text; begin
 foreach t in array array['official_registers','voter_identities','voter_identifiers','official_register_entries','voter_bindings','election_registers','register_election_decisions','election_classifications','candidate_slates','membership_support','public_request_limits'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('create policy live_session on public.%I as restrictive for all to authenticated using (public.is_active_session()) with check (public.is_active_session())',t);
 end loop;
end $$;
grant select on public.official_registers,public.official_register_entries to authenticated;
create policy chair_register_read on public.official_registers for select to authenticated using(public.has_committee_role(array['committee_chair']::public.committee_role[]));
create policy chair_entries_read on public.official_register_entries for select to authenticated using(public.has_committee_role(array['committee_chair']::public.committee_role[]));
grant select on public.election_registers,public.election_classifications,public.candidate_slates to authenticated;
create policy registry_election_read on public.election_registers for select to authenticated using(public.has_committee_role(array['committee_chair','verification_officer','election_administrator','candidate_review_officer','certifying_officer']::public.committee_role[],election_id));
create policy classification_read on public.election_classifications for select to authenticated using(public.has_committee_role(array['committee_chair','verification_officer','election_administrator','candidate_review_officer','certifying_officer']::public.committee_role[],election_id));
create policy slates_read on public.candidate_slates for select to authenticated using(public.has_committee_role(array['committee_chair','candidate_review_officer','election_administrator']::public.committee_role[],election_id));

create function public.register_validation(rows_input jsonb) returns jsonb language sql immutable set search_path='' as $$
 with rows as (
  select ordinality as line, value as record, count(*) over(partition by upper(trim(value->>'registrationNumber'))) as regs,
   count(*) over(partition by lower(trim(value->>'email'))) as emails
  from jsonb_array_elements(rows_input) with ordinality
 ) select coalesce(jsonb_agg(jsonb_build_object('line',line,'record',record,'errors',
  array_remove(array[
   case when coalesce(length(trim(record->>'fullName')),0) not between 3 and 120 then 'Full name is required (3–120 characters).' end,
   case when coalesce(record->>'registrationNumber','') !~ '^[A-Z0-9/-]{3,40}$' then 'Registration number must use 3–40 letters, digits, / or -.' end,
   case when coalesce(record->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(record->>'email')>254 then 'A valid email is required.' end,
   case when regs>1 then 'Duplicate registration number.' end,
   case when emails>1 then 'Duplicate email.' end
  ],null)) order by line),'[]'::jsonb) from rows;
$$;
revoke all on function public.register_validation(jsonb) from public,anon,authenticated;

create function public.stage_official_register(input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; rows_value jsonb:=input->'rows'; hash_value text; old public.official_registers%rowtype;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if input->>'classification'<>'synthetic' then raise exception 'Only synthetic local register staging is authorized'; end if;
 if jsonb_typeof(rows_value) is distinct from 'array' or jsonb_array_length(rows_value) not between 1 and 5000 or octet_length(rows_value::text)>5242880 then raise exception 'Invalid register size'; end if;
 -- Caller identity references are never accepted from an uploaded spreadsheet.
 select jsonb_agg(jsonb_build_object('fullName',left(trim(coalesce(x->>'fullName','')),121),'registrationNumber',upper(trim(coalesce(x->>'registrationNumber',''))),'email',lower(trim(coalesce(x->>'email','')))) order by n)
 into rows_value from jsonb_array_elements(rows_value) with ordinality as t(x,n);
 hash_value:=encode(extensions.digest(rows_value::text,'sha256'),'hex');
 select * into old from public.official_registers where created_by=auth.uid() and request_key=(input->>'requestKey')::uuid;
 if found then
  if old.snapshot_sha256<>hash_value or old.title<>trim(input->>'title') or old.source_sha256<>input->>'sourceSha256' or old.membership_opens<>(input->>'membershipOpens')::timestamptz or old.membership_closes<>(input->>'membershipCloses')::timestamptz or old.activation_opens<>(input->>'activationOpens')::timestamptz or old.activation_closes<>(input->>'activationCloses')::timestamptz then raise exception 'Idempotency key changed'; end if;
  return old.id;
 end if;
 insert into public.official_registers(title,classification,membership_opens,membership_closes,activation_opens,activation_closes,file_name,source_sha256,rows_snapshot,snapshot_sha256,request_key,created_by)
 values(trim(input->>'title'),'synthetic',(input->>'membershipOpens')::timestamptz,(input->>'membershipCloses')::timestamptz,(input->>'activationOpens')::timestamptz,(input->>'activationCloses')::timestamptz,left(input->>'fileName',120),input->>'sourceSha256',rows_value,hash_value,(input->>'requestKey')::uuid,auth.uid()) returning id into result;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),'register_staged','official_register',result,'Synthetic source and normalized snapshot retained; not authoritative');
 return result;
end $$;

create function public.approve_official_register(register_input uuid,hash_input text) returns void language plpgsql security definer set search_path='' as $$
declare r public.official_registers%rowtype; row_value jsonb; person uuid; other_person uuid;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 -- Serialize identity claims, approvals and membership suspension consistently.
 perform pg_advisory_xact_lock(140002);
 select * into r from public.official_registers where id=register_input for update;
 if not found or r.snapshot_sha256<>hash_input or r.classification<>'synthetic' then raise exception 'Register unavailable'; end if;
 if r.status='locked' then return; end if;
 if r.status<>'staging' or (r.parent_id is not null and (r.created_by=auth.uid() or length(trim(r.reason))<10)) then raise exception 'Independent correction approval required'; end if;
 if exists(select 1 from public.election_registers er join public.elections e on e.id=er.election_id where er.register_id=r.parent_id and e.status='open') then raise exception 'Corrections cannot change an election in progress'; end if;
 if exists(select 1 from jsonb_array_elements(public.register_validation(r.rows_snapshot)) x where jsonb_array_length(x->'errors')>0) then raise exception 'Fix all validation errors first'; end if;
 for row_value in select value from jsonb_array_elements(r.rows_snapshot) loop
  select identity_id into person from public.voter_identifiers where kind='registration' and value=row_value->>'registrationNumber';
  select identity_id into other_person from public.voter_identifiers where kind='email' and value=row_value->>'email';
  if row_value ? 'identityId' then
   if r.parent_id is null or not exists(select 1 from public.official_register_entries where register_id=r.parent_id and identity_id=(row_value->>'identityId')::uuid) then raise exception 'Invalid correction identity'; end if;
   if person is not null and person<>(row_value->>'identityId')::uuid then raise exception 'Conflicting registration identity'; end if;
   person:=(row_value->>'identityId')::uuid;
  end if;
  if other_person is not null and (person is null or other_person<>person) then raise exception 'Email belongs to a different registered identity'; end if;
  if person is null then insert into public.voter_identities default values returning id into person; end if;
  insert into public.voter_identifiers values('registration',row_value->>'registrationNumber',person) on conflict do nothing;
  insert into public.voter_identifiers values('email',row_value->>'email',person) on conflict do nothing;
  insert into public.official_register_entries values(r.id,person,row_value->>'registrationNumber',row_value->>'email',row_value->>'fullName');
 end loop;
 update public.official_registers set status='locked',approved_by=auth.uid(),approved_at=clock_timestamp() where id=r.id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),'register_approved_locked','official_register',r.id,'rows='||jsonb_array_length(r.rows_snapshot)||'; snapshot='||r.snapshot_sha256||'; '||left(r.reason,300));
end $$;

create function public.propose_register_correction(register_input uuid,registration_input text,name_input text,email_input text,new_registration_input text,reason_input text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.official_registers%rowtype; entries jsonb; person uuid; result uuid;
begin
 if not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if length(trim(reason_input)) not between 10 and 1000 then raise exception 'A documented reason is required'; end if;
 select * into r from public.official_registers where id=register_input and status='locked';
 select identity_id into person from public.official_register_entries where register_id=register_input and registration_number=upper(trim(registration_input));
 if r.id is null or person is null then raise exception 'Record unavailable'; end if;
 select jsonb_agg(case when x->>'registrationNumber'=upper(trim(registration_input)) then jsonb_build_object('registrationNumber',upper(trim(new_registration_input)),'fullName',trim(name_input),'email',lower(trim(email_input)),'identityId',person) else x end order by n)
 into entries from jsonb_array_elements(r.rows_snapshot) with ordinality as t(x,n);
 insert into public.official_registers(title,classification,parent_id,reason,membership_opens,membership_closes,activation_opens,activation_closes,file_name,source_sha256,rows_snapshot,snapshot_sha256,request_key,created_by)
 values(r.title,r.classification,r.id,trim(reason_input),r.membership_opens,r.membership_closes,r.activation_opens,r.activation_closes,'correction.json',encode(extensions.digest(entries::text,'sha256'),'hex'),entries,encode(extensions.digest(entries::text,'sha256'),'hex'),gen_random_uuid(),auth.uid()) returning id into result;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),'register_correction_proposed','official_register',result,left(trim(reason_input),1000));
 return result;
end $$;

create function public.has_student_access() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active_session() and exists(
  select 1 from public.voter_bindings b join public.voter_identities i on i.id=b.identity_id and i.status='active'
  join auth.users u on u.id=b.user_id and lower(u.email)=b.proof_email
  join public.official_register_entries re on re.identity_id=b.identity_id and re.email=b.proof_email
  join public.official_registers r on r.id=re.register_id and r.status='locked' and r.classification='synthetic'
  where b.user_id=auth.uid() and r.id=(select latest.id from public.official_registers latest where latest.status='locked' and latest.classification='synthetic' order by latest.approved_at desc,latest.id desc limit 1)
 );
$$;
create function public.has_election_student_access(election_input uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_student_access() and exists(
  select 1 from public.voter_bindings b join public.election_registers er on er.election_id=election_input
  join public.official_register_entries re on re.register_id=er.register_id and re.identity_id=b.identity_id and re.email=b.proof_email
  join public.register_election_decisions d on d.election_id=er.election_id and d.identity_id=b.identity_id and d.included
  join public.election_classifications c on c.election_id=er.election_id and c.classification='synthetic'
  join public.election_eligibility ee on ee.election_id=er.election_id and ee.user_id=b.user_id and ee.status='verified'
  where b.user_id=auth.uid()
 );
$$;

create function public.bind_official_voter(registration_input text) returns jsonb language plpgsql security definer set search_path='' as $$
declare email_value text; entry public.official_register_entries%rowtype; r public.official_registers%rowtype; existing public.voter_bindings%rowtype;
begin
 if not public.is_active_session() then raise exception 'Unable to activate this account. Contact the committee.'; end if;
 perform pg_advisory_xact_lock(140002);
 select lower(email) into email_value from auth.users where id=auth.uid() and email_confirmed_at is not null for share;
 select * into r from public.official_registers where status='locked' and classification='synthetic' order by approved_at desc,id desc limit 1;
 select re.* into entry from public.official_register_entries re join public.voter_identities i on i.id=re.identity_id and i.status='active'
 where re.register_id=r.id and re.registration_number=upper(trim(registration_input)) and re.email=email_value for share of re,i;
 if entry.identity_id is null or clock_timestamp()<r.activation_opens or clock_timestamp()>=r.activation_closes then raise exception 'Unable to activate this account. Contact the committee.'; end if;
 select * into existing from public.voter_bindings where user_id=auth.uid();
 if found then
  if existing.identity_id<>entry.identity_id or existing.proof_email<>email_value then raise exception 'Unable to activate this account. Contact the committee.'; end if;
 else
  if exists(select 1 from public.voter_bindings where identity_id=entry.identity_id) then raise exception 'Unable to activate this account. Contact the committee.'; end if;
  insert into public.voter_bindings values(auth.uid(),entry.identity_id,r.id,email_value,clock_timestamp());
  update public.profiles set registration_number=entry.registration_number,verification_status='verified' where id=auth.uid();
  insert into public.verification_history(user_id,status,reviewer_id,reason) values(auth.uid(),'verified',null,'Confirmed email bound to locked official register '||r.id);
  insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),'official_voter_activated','voter_binding',auth.uid(),'Approved version='||r.id);
 end if;
 -- Materialize only already-authorized election decisions, with the officer's provenance.
 insert into public.election_eligibility(election_id,user_id,status,decided_by,reason,decided_at)
 select er.election_id,auth.uid(),'verified',er.approved_by,'Approved register rule plan: '||er.rule_reference,er.approved_at
 from public.election_registers er join public.register_election_decisions d on d.election_id=er.election_id and d.identity_id=entry.identity_id and d.included
 join public.elections e on e.id=er.election_id and e.status in('draft','prepared')
 where er.register_id=r.id on conflict(election_id,user_id) do nothing;
 return jsonb_build_object('activated',true,'name',entry.full_name);
end $$;

create function public.get_my_membership() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_active_session() then raise exception 'Not authorized'; end if;
 if not public.has_student_access() then return jsonb_build_object('active',false); end if;
 select jsonb_build_object('active',true,'name',re.full_name,'registrationNumber',re.registration_number,'email',re.email,'rehearsal',true)
 into result from public.voter_bindings b join public.official_register_entries re on re.identity_id=b.identity_id and re.email=b.proof_email
 join public.official_registers r on r.id=re.register_id and r.status='locked' and r.classification='synthetic'
 where b.user_id=auth.uid() order by r.approved_at desc,r.id desc limit 1;
 return result;
end $$;

create function public.approve_register_eligibility(election_input uuid,register_input uuid,reference_input text,excluded_input text[] default '{}') returns integer language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; old public.election_registers%rowtype; total integer;
begin
 if not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[],election_input) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(140002);
 select * into e from public.elections where id=election_input for update;
 if not found or e.status not in('draft','prepared') or length(trim(reference_input)) not between 5 and 500 or cardinality(excluded_input)>5000 then raise exception 'Eligibility plan unavailable'; end if;
 if not exists(select 1 from public.election_classifications where election_id=e.id and classification='synthetic') or not exists(select 1 from public.official_registers where id=register_input and status='locked' and classification='synthetic') then raise exception 'Only approved synthetic rehearsal data can be used'; end if;
 if exists(select 1 from unnest(excluded_input) n where not exists(select 1 from public.official_register_entries re where re.register_id=register_input and re.registration_number=n)) then raise exception 'Unknown exception'; end if;
 select * into old from public.election_registers where election_id=e.id;
 if found then
  if old.register_id=register_input and old.rule_reference=trim(reference_input) and not exists(select 1 from public.register_election_decisions d join public.official_register_entries re on re.register_id=d.register_id and re.identity_id=d.identity_id where d.election_id=e.id and d.included=(re.registration_number=any(excluded_input))) then
   return (select count(*)::integer from public.register_election_decisions where election_id=e.id and included);
  end if;
  raise exception 'An approved election plan is immutable; prepare a separately reviewed election correction';
 end if;
 insert into public.election_registers values(e.id,register_input,trim(reference_input),auth.uid(),clock_timestamp());
 insert into public.register_election_decisions select e.id,register_input,re.identity_id,not(re.registration_number=any(excluded_input)),case when re.registration_number=any(excluded_input) then 'Excluded under approved rule: '||trim(reference_input) else '' end from public.official_register_entries re where re.register_id=register_input;
 select count(*) into total from public.register_election_decisions where election_id=e.id and included;
 insert into public.election_eligibility(election_id,user_id,status,decided_by,reason,decided_at)
 select e.id,b.user_id,case when d.included then 'verified'::public.review_status else 'rejected'::public.review_status end,auth.uid(),trim(reference_input),clock_timestamp()
 from public.register_election_decisions d join public.voter_bindings b on b.identity_id=d.identity_id where d.election_id=e.id
 on conflict(election_id,user_id) do update set status=excluded.status,decided_by=excluded.decided_by,reason=excluded.reason,decided_at=excluded.decided_at;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'register_eligibility_approved','election_register',register_input,e.id,'Included='||total||'; rule='||trim(reference_input));
 return total;
end $$;

create function public.suspend_official_voter(registration_input text,status_input text,reason_input text) returns void language plpgsql security definer set search_path='' as $$
declare person uuid;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if status_input not in('suspended','revoked') or length(trim(reason_input)) not between 10 and 1000 then raise exception 'Reason required'; end if;
 perform pg_advisory_xact_lock(140002);
 select identity_id into person from public.voter_identifiers where kind='registration' and value=upper(trim(registration_input));
 if person is null then raise exception 'Record unavailable'; end if;
 update public.voter_identities set status=status_input where id=person;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),'membership_'||status_input,'voter_identity',person,trim(reason_input));
end $$;

create function public.consume_public_limit(bucket_input text,key_input text,limit_input integer) returns boolean language plpgsql security definer set search_path='' as $$
declare hits_value integer; slot timestamptz:=date_trunc('hour',clock_timestamp());
begin
 if key_input !~ '^[a-f0-9]{64}$' or length(bucket_input)>40 or limit_input not between 1 and 10000 then raise exception 'Invalid limit'; end if;
 insert into public.public_request_limits values(bucket_input,key_input,slot,1)
 on conflict(bucket,key_hash,window_start) do update set hits=least(public.public_request_limits.hits+1,10001) returning hits into hits_value;
 return hits_value<=limit_input;
end $$;
revoke all on function public.consume_public_limit(text,text,integer) from public,anon,authenticated;
grant execute on function public.consume_public_limit(text,text,integer) to service_role;

create function public.submit_membership_support(email_input text,message_input text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if length(email_input)>254 or email_input !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Invalid message'; end if;
 insert into public.membership_support(user_id,email,message) values(auth.uid(),lower(trim(email_input)),trim(message_input)) returning id into result;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'membership_support_received','membership_support',result);
 return result;
end $$;
revoke all on function public.submit_membership_support(text,text) from public,anon,authenticated;
grant execute on function public.submit_membership_support(text,text) to service_role;
grant select on public.membership_support to authenticated;
create policy support_chair on public.membership_support for select to authenticated using(public.has_committee_role(array['committee_chair','verification_officer']::public.committee_role[]));

create function public.review_membership_support(id_input uuid,status_input text,response_input text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_committee_role(array['committee_chair','verification_officer']::public.committee_role[]) or status_input not in('reviewed','resolved','rejected') or length(trim(response_input)) not between 3 and 1000 then raise exception 'Not authorized or invalid review'; end if;
 update public.membership_support set status=status_input,response=trim(response_input),reviewed_by=auth.uid() where id=id_input;
 if not found then raise exception 'Case unavailable'; end if;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),'membership_support_'||status_input,'membership_support',id_input,left(trim(response_input),1000));
end $$;

-- Immutable evidence: lifecycle fields alone change at the authorized approval boundary.
create function public.guard_official_register() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.status='locked' or new.rows_snapshot is distinct from old.rows_snapshot or new.snapshot_sha256<>old.snapshot_sha256 then raise exception 'Register snapshot is immutable; propose a correction'; end if;
 return new;
end $$;
create trigger official_register_immutable before update or delete on public.official_registers for each row execute function public.guard_official_register();
create trigger official_entries_immutable before update or delete on public.official_register_entries for each row execute function public.reject_phase4_record_mutation();
create trigger binding_immutable before update or delete on public.voter_bindings for each row execute function public.reject_phase4_record_mutation();
create trigger identifier_immutable before update or delete on public.voter_identifiers for each row execute function public.reject_phase4_record_mutation();
create trigger rule_plan_immutable before update or delete on public.election_registers for each row execute function public.reject_phase4_record_mutation();
create trigger rule_decisions_immutable before update or delete on public.register_election_decisions for each row execute function public.reject_phase4_record_mutation();
create trigger slate_immutable before update or delete on public.candidate_slates for each row execute function public.reject_phase4_record_mutation();

-- Public execute is never inherited on newly introduced authority functions.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('stage_official_register','approve_official_register','propose_register_correction','has_student_access','has_election_student_access','bind_official_voter','get_my_membership','approve_register_eligibility','suspend_official_voter','review_membership_support') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
