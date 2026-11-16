-- Phase 4 foundation: confidential reconciliation, controlled complaints,
-- immutable certification snapshots, and gated publication.
create type public.complaint_status as enum ('submitted','under_review','awaiting_information','resolved','rejected','closed');

create table public.complaints (
 id uuid primary key default gen_random_uuid(),
 reference_code text not null unique default ('UCSA-'||to_char(clock_timestamp(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
 election_id uuid not null references public.elections(id) on delete restrict,
 student_id uuid not null references public.profiles(id) on delete restrict,
 category text not null check(category in('eligibility','candidate_conduct','campaign_process','voting_access','election_process','other')),
 description text not null check(char_length(trim(description)) between 20 and 5000),
 status public.complaint_status not null default 'submitted',
 assigned_to uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 closed_at timestamptz,
 unique(id,election_id)
);
create index complaints_election_status_idx on public.complaints(election_id,status,created_at desc);
create index complaints_student_idx on public.complaints(student_id,created_at desc);
alter table public.complaints enable row level security;
alter table public.complaints force row level security;
create policy complaints_read_owner on public.complaints for select to authenticated using(student_id=(select auth.uid()));
create policy complaints_read_reviewers on public.complaints for select to authenticated using(public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id));
revoke all on public.complaints from public,anon,authenticated;
grant select(id,reference_code,election_id,category,status,created_at,updated_at,closed_at) on public.complaints to authenticated;

create table public.complaint_events (
 id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.complaints(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete set null,
 event_type text not null check(char_length(event_type) between 2 and 40),
 from_status public.complaint_status, to_status public.complaint_status,
 public_note text check(public_note is null or char_length(public_note)<=3000),
 internal_note text check(internal_note is null or char_length(internal_note)<=3000),
 assigned_to uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create index complaint_events_timeline_idx on public.complaint_events(complaint_id,created_at,id);
alter table public.complaint_events enable row level security;
alter table public.complaint_events force row level security;
create policy complaint_events_owner_public on public.complaint_events for select to authenticated using(public_note is not null and exists(select 1 from public.complaints c where c.id=complaint_id and c.student_id=(select auth.uid())));
create policy complaint_events_reviewers on public.complaint_events for select to authenticated using(exists(select 1 from public.complaints c where c.id=complaint_id and public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id)));
revoke all on public.complaint_events from public,anon,authenticated;
grant select(id,complaint_id,actor_id,event_type,from_status,to_status,public_note,created_at) on public.complaint_events to authenticated;

create table public.complaint_documents (
 id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.complaints(id) on delete restrict,
 storage_path text not null unique check(char_length(storage_path)<=500), file_name text not null check(char_length(file_name) between 1 and 120),
 mime_type text not null check(mime_type in('image/jpeg','image/png','image/webp','application/pdf')),
 byte_size integer not null check(byte_size between 1 and 5242880), uploaded_by uuid not null references public.profiles(id) on delete restrict,
 uploaded_at timestamptz not null default now()
);
create index complaint_documents_complaint_idx on public.complaint_documents(complaint_id,uploaded_at);
alter table public.complaint_documents enable row level security;
alter table public.complaint_documents force row level security;
create policy complaint_documents_related on public.complaint_documents for select to authenticated using(exists(select 1 from public.complaints c where c.id=complaint_id and (c.student_id=(select auth.uid()) or public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id))));
revoke all on public.complaint_documents from public,anon,authenticated;
grant select(id,complaint_id,file_name,mime_type,byte_size,uploaded_at) on public.complaint_documents to authenticated;

create table public.election_certification_policies (
 id uuid primary key default gen_random_uuid(), election_id uuid not null unique references public.elections(id) on delete restrict,
 required_approvals smallint not null check(required_approvals between 1 and 5),
 policy_reference text not null check(char_length(trim(policy_reference)) between 5 and 500),
 complaints_required boolean not null default true, allow_reopen boolean not null default false,
 configured_by uuid not null references public.profiles(id) on delete restrict, configured_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.election_certification_policies enable row level security;
alter table public.election_certification_policies force row level security;
revoke all on public.election_certification_policies from public,anon,authenticated;

create table public.election_reconciliations (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id) on delete restrict,
 revision integer not null check(revision>0), status text not null check(status in('passed','discrepancy')),
 ballot_total bigint not null check(ballot_total>=0), participation_total bigint not null check(participation_total>=0),
 invalid_total bigint not null check(invalid_total>=0), discrepancy_count integer not null check(discrepancy_count>=0),
 summary jsonb not null check(jsonb_typeof(summary)='object'), reviewed_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), unique(election_id,revision), unique(id,election_id)
);
create index election_reconciliations_latest_idx on public.election_reconciliations(election_id,revision desc);
alter table public.election_reconciliations enable row level security;
alter table public.election_reconciliations force row level security;
revoke all on public.election_reconciliations from public,anon,authenticated;

create table public.election_reconciliation_offices (
 reconciliation_id uuid not null references public.election_reconciliations(id) on delete restrict,
 election_id uuid not null references public.elections(id) on delete restrict,
 office_id uuid not null references public.election_offices(id) on delete restrict,
 ballot_count bigint not null check(ballot_count>=0), participation_count bigint not null check(participation_count>=0),
 valid_count bigint not null check(valid_count>=0), invalid_count bigint not null check(invalid_count>=0),
 reconciled boolean not null,
 primary key(reconciliation_id,office_id),
 foreign key(reconciliation_id,election_id) references public.election_reconciliations(id,election_id) on delete restrict
);
alter table public.election_reconciliation_offices enable row level security;
alter table public.election_reconciliation_offices force row level security;
revoke all on public.election_reconciliation_offices from public,anon,authenticated;

create table public.election_candidate_snapshots (
 reconciliation_id uuid not null,
 election_id uuid not null,
 office_id uuid not null,
 candidate_application_id uuid not null references public.candidate_applications(id) on delete restrict,
 candidate_name text not null check(char_length(candidate_name) between 1 and 120),
 vote_count bigint not null check(vote_count>=0), percentage numeric(9,4) not null check(percentage between 0 and 100),
 rank integer not null check(rank>0), tied_at_top boolean not null,
 primary key(reconciliation_id,office_id,candidate_application_id),
 foreign key(reconciliation_id,office_id) references public.election_reconciliation_offices(reconciliation_id,office_id) on delete restrict,
 foreign key(election_id,office_id,candidate_application_id) references public.candidate_applications(election_id,office_id,id) on delete restrict
);
alter table public.election_candidate_snapshots enable row level security;
alter table public.election_candidate_snapshots force row level security;
revoke all on public.election_candidate_snapshots from public,anon,authenticated;

create table public.election_certification_approvals (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id) on delete restrict,
 reconciliation_id uuid not null references public.election_reconciliations(id) on delete restrict,
 officer_id uuid not null references public.profiles(id) on delete restrict,
 decision text not null check(decision in('approved','rejected')),
 reason text not null default '' check(char_length(reason)<=1000), decided_at timestamptz not null default now(),
 unique(reconciliation_id,officer_id), unique(id,election_id)
);
alter table public.election_certification_approvals enable row level security;
alter table public.election_certification_approvals force row level security;
revoke all on public.election_certification_approvals from public,anon,authenticated;

create table public.election_certifications (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id) on delete restrict,
 reconciliation_id uuid not null references public.election_reconciliations(id) on delete restrict,
 supersedes_id uuid references public.election_certifications(id) on delete restrict,
 certification_reference text not null unique,
 approval_snapshot jsonb not null check(jsonb_typeof(approval_snapshot)='array'),
 result_snapshot jsonb not null check(jsonb_typeof(result_snapshot)='object'),
 snapshot_sha256 text not null check(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 certified_by uuid not null references public.profiles(id) on delete restrict, certified_at timestamptz not null default now(),
 unique(id,election_id)
);
alter table public.election_certifications enable row level security;
alter table public.election_certifications force row level security;
revoke all on public.election_certifications from public,anon,authenticated;

create table public.election_publications (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id) on delete restrict,
 certification_id uuid not null references public.election_certifications(id) on delete restrict,
 publication_version integer not null check(publication_version>0), published_by uuid not null references public.profiles(id) on delete restrict,
 published_at timestamptz not null default now(), publication_note text not null default '' check(char_length(publication_note)<=500),
 unique(election_id,publication_version), unique(id,election_id)
);
alter table public.election_publications enable row level security;
alter table public.election_publications force row level security;
revoke all on public.election_publications from public,anon,authenticated;

create table public.election_result_corrections (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id) on delete restrict,
 certification_id uuid not null references public.election_certifications(id) on delete restrict,
 correction_reference text not null unique,
 reason text not null check(char_length(trim(reason)) between 10 and 2000),
 proposed_note text not null check(char_length(trim(proposed_note)) between 5 and 2000),
 recorded_by uuid not null references public.profiles(id) on delete restrict, recorded_at timestamptz not null default now()
);
alter table public.election_result_corrections enable row level security;
alter table public.election_result_corrections force row level security;
revoke all on public.election_result_corrections from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('complaint-private','complaint-private',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy complaint_evidence_read_related on storage.objects for select to authenticated using(
 bucket_id='complaint-private' and exists(select 1 from public.complaints c
  where c.id::text=(storage.foldername(name))[2] and
  ((storage.foldername(name))[1]=c.student_id::text and c.student_id=(select auth.uid()) or public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id)))
);

create function public.submit_complaint(election_id_input uuid,category_input text,description_input text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare new_id uuid; new_reference text; active_account boolean;
begin
 if auth.uid() is null then raise exception 'Not authorized'; end if;
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=auth.uid() and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()) and p.verification_status='verified') into active_account;
 if not active_account then raise exception 'Not authorized'; end if;
 if category_input not in('eligibility','candidate_conduct','campaign_process','voting_access','election_process','other') or char_length(trim(description_input)) not between 20 and 5000
  or not exists(select 1 from public.elections where id=election_id_input and status<>'draft') then raise exception 'Invalid complaint'; end if;
 insert into public.complaints(election_id,student_id,category,description) values(election_id_input,auth.uid(),category_input,trim(description_input)) returning id,reference_code into new_id,new_reference;
 insert into public.complaint_events(complaint_id,actor_id,event_type,to_status,public_note) values(new_id,auth.uid(),'submitted','submitted','Your complaint has been received for review.');
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'complaint_submitted','complaint',new_id,election_id_input);
 return jsonb_build_object('id',new_id,'reference',new_reference,'status','submitted');
end $$;
revoke all on function public.submit_complaint(uuid,text,text) from public,anon;
grant execute on function public.submit_complaint(uuid,text,text) to authenticated;

create function public.reply_to_complaint(complaint_id_input uuid,message_input text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.complaints%rowtype;
begin
 select * into c from public.complaints where id=complaint_id_input and student_id=auth.uid() for update;
 if not found or c.status<>'awaiting_information' or char_length(trim(message_input)) not between 3 and 3000 then raise exception 'Complaint reply unavailable'; end if;
 insert into public.complaint_events(complaint_id,actor_id,event_type,from_status,to_status,public_note) values(c.id,auth.uid(),'student_reply',c.status,'under_review',trim(message_input));
 update public.complaints set status='under_review',updated_at=now() where id=c.id;
end $$;
revoke all on function public.reply_to_complaint(uuid,text) from public,anon;
grant execute on function public.reply_to_complaint(uuid,text) to authenticated;

create function public.review_complaint(complaint_id_input uuid,action_input text,public_note_input text default '',internal_note_input text default '',assigned_to_input uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare c public.complaints%rowtype; next_status public.complaint_status; policy_row public.election_certification_policies%rowtype;
begin
 select * into c from public.complaints where id=complaint_id_input for update;
 if not found or not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id) then raise exception 'Not authorized'; end if;
 if char_length(public_note_input)>3000 or char_length(internal_note_input)>3000 then raise exception 'Invalid note'; end if;
 if assigned_to_input is not null and not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id) then raise exception 'Invalid assignment'; end if;
 if assigned_to_input is not null and not exists(select 1 from public.committee_members cm where cm.user_id=assigned_to_input and cm.role in('certifying_officer','committee_chair') and (cm.election_id is null or cm.election_id=c.election_id)) then raise exception 'Invalid assignment'; end if;
 select * into policy_row from public.election_certification_policies where election_id=c.election_id;
 if action_input='under_review' and c.status in('submitted','awaiting_information') then next_status:='under_review';
 elsif action_input='awaiting_information' and c.status in('submitted','under_review') and char_length(trim(public_note_input))>=3 then next_status:='awaiting_information';
 elsif action_input='resolved' and c.status in('submitted','under_review','awaiting_information') and char_length(trim(public_note_input))>=3 then next_status:='resolved';
 elsif action_input='rejected' and c.status in('submitted','under_review','awaiting_information') and char_length(trim(public_note_input))>=3 then next_status:='rejected';
 elsif action_input='closed' and c.status in('resolved','rejected') then next_status:='closed';
 elsif action_input='reopen' and c.status in('resolved','rejected') and policy_row.allow_reopen and public.has_committee_role(array['committee_chair']::public.committee_role[],c.election_id) then next_status:='under_review';
 else raise exception 'Invalid complaint transition'; end if;
 insert into public.complaint_events(complaint_id,actor_id,event_type,from_status,to_status,public_note,internal_note,assigned_to)
 values(c.id,auth.uid(),case when action_input='reopen' then 'reopened' else 'reviewed' end,c.status,next_status,nullif(trim(public_note_input),''),nullif(trim(internal_note_input),''),assigned_to_input);
 update public.complaints set status=next_status,assigned_to=coalesce(assigned_to_input,assigned_to),updated_at=now(),closed_at=case when next_status='closed' then now() else null end where id=c.id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'complaint_'||action_input,'complaint',c.id,c.election_id);
end $$;
revoke all on function public.review_complaint(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.review_complaint(uuid,text,text,text,uuid) to authenticated;

create function public.record_complaint_document(complaint_id_input uuid,path_input text,file_name_input text,mime_input text,size_input integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not exists(select 1 from public.complaints c where c.id=complaint_id_input and c.student_id=auth.uid() and c.status in('submitted','under_review','awaiting_information') and path_input like c.student_id::text||'/'||c.id::text||'/%') then raise exception 'Evidence upload is not allowed'; end if;
 if mime_input not in('image/jpeg','image/png','image/webp','application/pdf') or size_input not between 1 and 5242880 or char_length(file_name_input) not between 1 and 120 then raise exception 'Invalid evidence'; end if;
 insert into public.complaint_documents(complaint_id,storage_path,file_name,mime_type,byte_size,uploaded_by) values(complaint_id_input,path_input,file_name_input,mime_input,size_input,auth.uid()) returning id into new_id;
 insert into public.complaint_events(complaint_id,actor_id,event_type,public_note) values(complaint_id_input,auth.uid(),'evidence_added','Supporting evidence was attached to the complaint.');
 return new_id;
end $$;
revoke all on function public.record_complaint_document(uuid,text,text,text,integer) from public,anon;
grant execute on function public.record_complaint_document(uuid,text,text,text,integer) to authenticated;

create function public.get_complaint_details(complaint_id_input uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.complaints%rowtype; reviewer boolean; result jsonb;
begin
 select * into c from public.complaints where id=complaint_id_input;
 if not found then raise exception 'Complaint unavailable'; end if;
 reviewer:=public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id);
 if c.student_id<>auth.uid() and not reviewer then raise exception 'Complaint unavailable'; end if;
 select jsonb_build_object('complaint',jsonb_build_object('id',c.id,'reference',c.reference_code,'electionId',c.election_id,'electionTitle',(select title from public.elections where id=c.election_id),'category',c.category,'description',c.description,'status',c.status,'createdAt',c.created_at,'updatedAt',c.updated_at,'assignedTo',case when reviewer then c.assigned_to else null end,'studentName',case when reviewer then (select full_name from public.profiles where id=c.student_id) else null end),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',ev.id,'type',ev.event_type,'fromStatus',ev.from_status,'toStatus',ev.to_status,'publicNote',ev.public_note,'internalNote',case when reviewer then ev.internal_note else null end,'actorId',case when reviewer then ev.actor_id else null end,'createdAt',ev.created_at) order by ev.created_at,ev.id) from public.complaint_events ev where ev.complaint_id=c.id and (reviewer or ev.public_note is not null)),'[]'::jsonb),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'fileName',d.file_name,'mimeType',d.mime_type,'uploadedAt',d.uploaded_at) order by d.uploaded_at) from public.complaint_documents d where d.complaint_id=c.id),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_complaint_details(uuid) from public,anon;
grant execute on function public.get_complaint_details(uuid) to authenticated;

create function public.configure_election_certification_policy(election_id_input uuid,approvals_input smallint,reference_input text,complaints_required_input boolean,allow_reopen_input boolean)
returns void language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input for update;
 if not found or e.status not in('draft','prepared') or approvals_input not between 1 and 5 or char_length(trim(reference_input)) not between 5 and 500 then raise exception 'Invalid certification policy'; end if;
 insert into public.election_certification_policies(election_id,required_approvals,policy_reference,complaints_required,allow_reopen,configured_by)
 values(election_id_input,approvals_input,trim(reference_input),complaints_required_input,allow_reopen_input,auth.uid())
 on conflict(election_id) do update set required_approvals=excluded.required_approvals,policy_reference=excluded.policy_reference,complaints_required=excluded.complaints_required,allow_reopen=excluded.allow_reopen,configured_by=auth.uid(),configured_at=now(),updated_at=now();
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'certification_policy_configured','certification_policy',null,election_id_input,'Policy reference: '||left(trim(reference_input),450));
end $$;
revoke all on function public.configure_election_certification_policy(uuid,smallint,text,boolean,boolean) from public,anon;
grant execute on function public.configure_election_certification_policy(uuid,smallint,text,boolean,boolean) to authenticated;

create function public.reconcile_election_results(election_id_input uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; rec_id uuid; rev integer; ballots bigint; participation bigint; invalid_votes bigint; offices integer; mismatches integer; summary_value jsonb;
begin
 if not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input for update;
 if not found or e.status<>'closed' or clock_timestamp()<e.voting_end or exists(select 1 from public.election_certifications where election_id=election_id_input) then raise exception 'Election is not ready for reconciliation'; end if;
 select coalesce(max(revision),0)+1 into rev from public.election_reconciliations where election_id=election_id_input;
 insert into public.election_reconciliations(election_id,revision,status,ballot_total,participation_total,invalid_total,discrepancy_count,summary,reviewed_by)
 values(election_id_input,rev,'discrepancy',0,0,0,0,'{}',auth.uid()) returning id into rec_id;
 select count(*) into offices from public.election_offices where election_id=election_id_input and is_active;
 if offices=0 then mismatches:=1; else mismatches:=0; end if;
 for ballots,participation,invalid_votes in
  select stats.ballot_count,stats.participation_count,stats.invalid_count from (
   select o.id,
    (select count(*) from public.anonymous_ballots b where b.election_id=election_id_input and b.office_id=o.id) ballot_count,
    (select count(*) from public.vote_participation vp where vp.election_id=election_id_input and vp.office_id=o.id) participation_count,
    (select count(*) from public.anonymous_ballots b join public.candidate_applications a on a.id=b.candidate_application_id where b.election_id=election_id_input and b.office_id=o.id and a.status<>'approved') invalid_count
   from public.election_offices o where o.election_id=election_id_input and o.is_active
  ) stats
 loop
  if ballots<>participation or invalid_votes>0 then mismatches:=mismatches+1; end if;
 end loop;
 insert into public.election_reconciliation_offices(reconciliation_id,election_id,office_id,ballot_count,participation_count,valid_count,invalid_count,reconciled)
 select rec_id,election_id_input,o.id,
  (select count(*) from public.anonymous_ballots b where b.election_id=election_id_input and b.office_id=o.id),
  (select count(*) from public.vote_participation vp where vp.election_id=election_id_input and vp.office_id=o.id),
  (select count(*) from public.anonymous_ballots b join public.candidate_applications a on a.id=b.candidate_application_id where b.election_id=election_id_input and b.office_id=o.id and a.status='approved'),
  (select count(*) from public.anonymous_ballots b join public.candidate_applications a on a.id=b.candidate_application_id where b.election_id=election_id_input and b.office_id=o.id and a.status<>'approved'),
  (select count(*) from public.anonymous_ballots b where b.election_id=election_id_input and b.office_id=o.id)=(select count(*) from public.vote_participation vp where vp.election_id=election_id_input and vp.office_id=o.id)
   and not exists(select 1 from public.anonymous_ballots b join public.candidate_applications a on a.id=b.candidate_application_id where b.election_id=election_id_input and b.office_id=o.id and a.status<>'approved')
 from public.election_offices o where o.election_id=election_id_input and o.is_active;
 if mismatches=0 then
  insert into public.election_candidate_snapshots(reconciliation_id,election_id,office_id,candidate_application_id,candidate_name,vote_count,percentage,rank,tied_at_top)
  select rec_id,election_id_input,o.id,a.id,p.full_name,count(b.ballot_id),
   case when (select count(*) from public.anonymous_ballots bb where bb.election_id=election_id_input and bb.office_id=o.id)=0 then 0
    else round(count(b.ballot_id)::numeric*100/(select count(*) from public.anonymous_ballots bb where bb.election_id=election_id_input and bb.office_id=o.id),4) end,
   rank() over(partition by o.id order by count(b.ballot_id) desc),
   count(b.ballot_id)=(select max(counted) from (select count(*) counted from public.anonymous_ballots bb where bb.election_id=election_id_input and bb.office_id=o.id group by bb.candidate_application_id) totals)
   and (select count(*) from (select bb.candidate_application_id from public.anonymous_ballots bb where bb.election_id=election_id_input and bb.office_id=o.id group by bb.candidate_application_id having count(*)=(select max(counted) from (select count(*) counted from public.anonymous_ballots bbb where bbb.election_id=election_id_input and bbb.office_id=o.id group by bbb.candidate_application_id) m)) ties)>1,
   false
  from public.election_offices o join public.candidate_applications a on a.election_id=o.election_id and a.office_id=o.id and a.status='approved'
  join public.profiles p on p.id=a.user_id left join public.anonymous_ballots b on b.election_id=election_id_input and b.office_id=o.id and b.candidate_application_id=a.id
  where o.election_id=election_id_input and o.is_active group by o.id,a.id,p.full_name;
 end if;
 update public.election_reconciliations set status=case when mismatches=0 then 'passed' else 'discrepancy' end,
  ballot_total=(select coalesce(sum(ballot_count),0) from public.election_reconciliation_offices where reconciliation_id=rec_id),
  participation_total=(select coalesce(sum(participation_count),0) from public.election_reconciliation_offices where reconciliation_id=rec_id),
  invalid_total=(select coalesce(sum(invalid_count),0) from public.election_reconciliation_offices where reconciliation_id=rec_id),
  discrepancy_count=mismatches,
  summary=jsonb_build_object('electionId',election_id_input,'offices',offices,'discrepancies',mismatches,'reconciledAt',clock_timestamp()) where id=rec_id;
 select jsonb_build_object('id',r.id,'electionId',r.election_id,'revision',r.revision,'status',r.status,'ballotTotal',r.ballot_total,'participationTotal',r.participation_total,'invalidTotal',r.invalid_total,'discrepancyCount',r.discrepancy_count,'summary',r.summary,
  'offices',coalesce((select jsonb_agg(jsonb_build_object('officeId',ro.office_id,'ballotCount',ro.ballot_count,'participationCount',ro.participation_count,'validCount',ro.valid_count,'invalidCount',ro.invalid_count,'reconciled',ro.reconciled)) from public.election_reconciliation_offices ro where ro.reconciliation_id=r.id),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(jsonb_build_object('officeId',cs.office_id,'candidateId',cs.candidate_application_id,'name',cs.candidate_name,'votes',cs.vote_count,'percentage',cs.percentage,'rank',cs.rank,'tiedAtTop',cs.tied_at_top)) from public.election_candidate_snapshots cs where cs.reconciliation_id=r.id),'[]'::jsonb)) into summary_value from public.election_reconciliations r where r.id=rec_id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'results_reconciled','election_reconciliation',rec_id,election_id_input,'status='||(select status from public.election_reconciliations where id=rec_id)||'; discrepancy_count='||mismatches);
 return summary_value;
end $$;
revoke all on function public.reconcile_election_results(uuid) from public,anon;
grant execute on function public.reconcile_election_results(uuid) to authenticated;

create function public.record_certification_approval(election_id_input uuid,reconciliation_id_input uuid,decision_input text,reason_input text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 if decision_input not in('approved','rejected') or char_length(reason_input)>1000 or (decision_input='rejected' and char_length(trim(reason_input))<3)
  or not exists(select 1 from public.election_reconciliations r join public.elections e on e.id=r.election_id where r.id=reconciliation_id_input and r.election_id=election_id_input and r.status='passed' and e.status='closed' and clock_timestamp()>=e.voting_end)
  or exists(select 1 from public.election_certifications c where c.election_id=election_id_input) then raise exception 'Certification approval unavailable'; end if;
 insert into public.election_certification_approvals(election_id,reconciliation_id,officer_id,decision,reason) values(election_id_input,reconciliation_id_input,auth.uid(),decision_input,trim(reason_input)) returning id into new_id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'certification_'||decision_input,'certification_approval',new_id,election_id_input,left(trim(reason_input),1000));
 return new_id;
end $$;
revoke all on function public.record_certification_approval(uuid,uuid,text,text) from public,anon;
grant execute on function public.record_certification_approval(uuid,uuid,text,text) to authenticated;

create function public.certify_election_results(election_id_input uuid,reconciliation_id_input uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; policy_row public.election_certification_policies%rowtype; cert_id uuid; cert_ref text; approval_data jsonb; result_data jsonb; hash_value text; recon public.election_reconciliations%rowtype;
begin
 if not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input for update;
 select * into policy_row from public.election_certification_policies where election_id=election_id_input;
 select * into recon from public.election_reconciliations where id=reconciliation_id_input and election_id=election_id_input;
 if not found or e.status<>'closed' or clock_timestamp()<e.voting_end or recon.status<>'passed' or policy_row.id is null
  or exists(select 1 from public.election_reconciliations r where r.election_id=election_id_input and r.revision>recon.revision)
  or exists(select 1 from public.election_certifications where election_id=election_id_input and reconciliation_id=reconciliation_id_input)
  or (policy_row.complaints_required and exists(select 1 from public.complaints c where c.election_id=election_id_input and c.status not in('resolved','rejected','closed')))
  or exists(select 1 from public.election_certification_approvals a where a.reconciliation_id=reconciliation_id_input and a.decision='rejected')
  or (select count(*) from public.election_certification_approvals a where a.reconciliation_id=reconciliation_id_input and a.decision='approved')<policy_row.required_approvals then raise exception 'Certification prerequisites are not satisfied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('officerId',a.officer_id,'decision',a.decision,'decidedAt',a.decided_at,'reason',a.reason) order by a.decided_at,a.officer_id),'[]'::jsonb) into approval_data from public.election_certification_approvals a where a.reconciliation_id=reconciliation_id_input and a.decision='approved';
 select jsonb_build_object('electionId',e.id,'title',e.title,'description',e.description,'votingStart',e.voting_start,'votingEnd',e.voting_end,'reconciliationId',recon.id,'revision',recon.revision,'ballotTotal',recon.ballot_total,'participationTotal',recon.participation_total,'offices',coalesce((select jsonb_agg(jsonb_build_object('officeId',ro.office_id,'officeTitle',o.title,'ballotCount',ro.ballot_count,'participationCount',ro.participation_count,'candidates',coalesce((select jsonb_agg(jsonb_build_object('candidateId',cs.candidate_application_id,'name',cs.candidate_name,'votes',cs.vote_count,'percentage',cs.percentage,'rank',cs.rank,'tiedAtTop',cs.tied_at_top) order by cs.rank,cs.candidate_name) from public.election_candidate_snapshots cs where cs.reconciliation_id=recon.id and cs.office_id=ro.office_id),'[]'::jsonb)) order by o.display_order) from public.election_reconciliation_offices ro join public.election_offices o on o.id=ro.office_id where ro.reconciliation_id=recon.id),'[]'::jsonb)) into result_data;
 hash_value:=encode(extensions.digest(convert_to(result_data::text,'UTF8'),'sha256'),'hex');
 cert_ref:='UCSA-CERT-'||to_char(clock_timestamp(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.election_certifications(election_id,reconciliation_id,certification_reference,approval_snapshot,result_snapshot,snapshot_sha256,certified_by)
 values(election_id_input,reconciliation_id_input,cert_ref,approval_data,result_data,hash_value,auth.uid()) returning id into cert_id;
 update public.elections set status='certified',updated_at=clock_timestamp() where id=election_id_input;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'certified','election_certification',cert_id,election_id_input,'reference='||cert_ref||'; snapshot_sha256='||hash_value);
 return jsonb_build_object('id',cert_id,'reference',cert_ref,'certifiedAt',clock_timestamp(),'snapshotSha256',hash_value,'snapshot',result_data,'approvals',approval_data);
end $$;
revoke all on function public.certify_election_results(uuid,uuid) from public,anon;
grant execute on function public.certify_election_results(uuid,uuid) to authenticated;

create function public.publish_certified_election_results(election_id_input uuid,certification_id_input uuid,note_input text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare version_no integer; pub_id uuid; pub_time timestamptz:=clock_timestamp();
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 if char_length(note_input)>500 or not exists(select 1 from public.election_certifications c join public.elections e on e.id=c.election_id where c.id=certification_id_input and c.election_id=election_id_input and e.status='certified') then raise exception 'Publication prerequisites are not satisfied'; end if;
 select coalesce(max(publication_version),0)+1 into version_no from public.election_publications where election_id=election_id_input;
 insert into public.election_publications(election_id,certification_id,publication_version,published_by,publication_note) values(election_id_input,certification_id_input,version_no,auth.uid(),trim(note_input)) returning id into pub_id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'results_published','election_publication',pub_id,election_id_input);
 return jsonb_build_object('publicationId',pub_id,'version',version_no,'publishedAt',pub_time);
end $$;
revoke all on function public.publish_certified_election_results(uuid,uuid,text) from public,anon;
grant execute on function public.publish_certified_election_results(uuid,uuid,text) to authenticated;

create function public.record_certification_correction(election_id_input uuid,certification_id_input uuid,reason_input text,note_input text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare correction_id uuid; correction_ref text;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 if char_length(trim(reason_input)) not between 10 and 2000 or char_length(trim(note_input)) not between 5 and 2000
  or not exists(select 1 from public.election_certifications where id=certification_id_input and election_id=election_id_input) then raise exception 'Invalid certification correction'; end if;
 correction_ref:='UCSA-CORR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.election_result_corrections(election_id,certification_id,correction_reference,reason,proposed_note,recorded_by) values(election_id_input,certification_id_input,correction_ref,trim(reason_input),trim(note_input),auth.uid()) returning id into correction_id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),'certification_correction_recorded','result_correction',correction_id,election_id_input,left(trim(reason_input),1000));
 return jsonb_build_object('id',correction_id,'reference',correction_ref,'note','Recorded as a separate correction event. The certified result snapshot is unchanged.');
end $$;
revoke all on function public.record_certification_correction(uuid,uuid,text,text) from public,anon;
grant execute on function public.record_certification_correction(uuid,uuid,text,text) to authenticated;

create function public.get_certification_workspace(election_id_input uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections%rowtype; result jsonb; latest_id uuid;
begin
 if not public.has_committee_role(array['election_administrator','certifying_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 select * into e from public.elections where id=election_id_input;
 if not found or e.status in('open','prepared','draft') then raise exception 'Certification workspace unavailable'; end if;
 select id into latest_id from public.election_reconciliations where election_id=election_id_input order by revision desc limit 1;
 select jsonb_build_object('election',jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'status',e.status,'votingStart',e.voting_start,'votingEnd',e.voting_end),
  'policy',(select to_jsonb(p)-'configured_by' from public.election_certification_policies p where p.election_id=e.id),
  'unresolvedComplaints',(select count(*) from public.complaints c where c.election_id=e.id and c.status not in('resolved','rejected','closed')),
  'reconciliation',case when latest_id is null then null else (select to_jsonb(r)||jsonb_build_object('offices',coalesce((select jsonb_agg(to_jsonb(o)) from public.election_reconciliation_offices o where o.reconciliation_id=r.id),'[]'::jsonb),'candidates',coalesce((select jsonb_agg(to_jsonb(cs)) from public.election_candidate_snapshots cs where cs.reconciliation_id=r.id),'[]'::jsonb)) from public.election_reconciliations r where r.id=latest_id) end,
  'approvals',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'officerId',a.officer_id,'decision',a.decision,'reason',a.reason,'decidedAt',a.decided_at)) from public.election_certification_approvals a where a.reconciliation_id=latest_id),'[]'::jsonb),
  'certifications',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'reference',c.certification_reference,'certifiedAt',c.certified_at,'certifiedBy',c.certified_by,'snapshotSha256',c.snapshot_sha256,'snapshot',c.result_snapshot)) from public.election_certifications c where c.election_id=e.id),'[]'::jsonb),
  'publications',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'version',p.publication_version,'publishedAt',p.published_at,'publishedBy',p.published_by)) from public.election_publications p where p.election_id=e.id),'[]'::jsonb),
  'corrections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'reference',c.correction_reference,'reason',c.reason,'note',c.proposed_note,'recordedAt',c.recorded_at,'recordedBy',c.recorded_by)) from public.election_result_corrections c where c.election_id=e.id),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_certification_workspace(uuid) from public,anon;
grant execute on function public.get_certification_workspace(uuid) to authenticated;

create function public.get_published_election_results(election_id_input uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('election',c.result_snapshot,'certificationReference',c.certification_reference,'certifiedAt',c.certified_at,'publicationReference',p.id,'publicationVersion',p.publication_version,'publishedAt',p.published_at,'publicationNote',p.publication_note)
 from public.election_publications p join public.election_certifications c on c.id=p.certification_id and c.election_id=p.election_id join public.elections e on e.id=p.election_id and e.status='certified'
 where p.election_id=election_id_input order by p.publication_version desc limit 1;
$$;
revoke all on function public.get_published_election_results(uuid) from public;
grant execute on function public.get_published_election_results(uuid) to anon,authenticated;

revoke all on function public.get_closed_election_tally(uuid) from authenticated;
grant execute on function public.get_closed_election_tally(uuid) to authenticated;
