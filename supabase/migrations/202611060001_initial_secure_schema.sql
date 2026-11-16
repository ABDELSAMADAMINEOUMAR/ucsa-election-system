create extension if not exists pgcrypto with schema extensions;
create type public.committee_role as enum ('verification_officer','candidate_review_officer','election_administrator','certifying_officer','committee_chair');
create type public.review_status as enum ('pending','verified','rejected','revoked');
create type public.application_status as enum ('draft','submitted','approved','rejected');
create type public.election_status as enum ('draft','prepared','open','closed','pending_certification','certified');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, email text not null,
 full_name text not null default '' check(char_length(full_name)<=120),
 registration_number text unique check(registration_number is null or char_length(registration_number) between 3 and 40),
 verification_status public.review_status not null default 'pending',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index profiles_verification_idx on public.profiles(verification_status);
create table public.elections (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 5 and 120),
 description text not null default '' check(char_length(description)<=1500),
 nominations_start timestamptz not null, nominations_end timestamptz not null, voting_start timestamptz not null, voting_end timestamptz not null,
 status public.election_status not null default 'draft', created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(nominations_start<nominations_end and nominations_end<voting_start and voting_start<voting_end)
);
create index elections_status_idx on public.elections(status,voting_start);
create table public.committee_members (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
 role public.committee_role not null, election_id uuid references public.elections(id) on delete cascade,
 added_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(),
 unique nulls not distinct (user_id,role,election_id)
);
create index committee_members_user_role_idx on public.committee_members(user_id,role);
create table public.eligible_students (
 id uuid primary key default gen_random_uuid(), registration_number text not null unique check(char_length(registration_number) between 3 and 40),
 verified_email text not null unique, roster_status text not null default 'approved' check(roster_status in ('approved','withdrawn')),
 imported_at timestamptz not null default now(), imported_by uuid references public.profiles(id) on delete set null
);
create table public.student_verification_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 requested_registration_number text not null check(char_length(requested_registration_number) between 3 and 40),
 status public.review_status not null default 'pending', reviewer_id uuid references public.profiles(id) on delete set null,
 reason text check(reason is null or char_length(reason)<=1000), created_at timestamptz not null default now(), reviewed_at timestamptz,
 check((status='pending' and reviewer_id is null and reviewed_at is null) or (status<>'pending' and reviewed_at is not null and (reviewer_id is not null or status='revoked')))
);
create index verification_requests_status_idx on public.student_verification_requests(status,created_at);
create table public.election_offices (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id) on delete cascade,
 title text not null check(char_length(title) between 2 and 80), description text not null default '' check(char_length(description)<=500),
 display_order smallint not null default 0 check(display_order>=0), created_at timestamptz not null default now(),
 unique(election_id,title), unique(election_id,display_order)
);
create index election_offices_idx on public.election_offices(election_id,display_order);
create table public.election_eligibility (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, status public.review_status not null default 'pending',
 decided_by uuid references public.profiles(id) on delete set null, reason text check(reason is null or char_length(reason)<=1000),
 decided_at timestamptz, created_at timestamptz not null default now(), unique(election_id,user_id),
 check((status='pending' and decided_by is null and decided_at is null) or (status<>'pending' and decided_at is not null and (decided_by is not null or status='revoked')))
);
create index election_eligibility_lookup_idx on public.election_eligibility(election_id,status);
create table public.candidate_applications (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id) on delete restrict,
 office_id uuid not null references public.election_offices(id) on delete restrict, user_id uuid not null references public.profiles(id) on delete restrict,
 biography text not null default '' check(char_length(biography)<=1000), manifesto text not null default '' check(char_length(manifesto)<=5000),
 status public.application_status not null default 'draft', submitted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(election_id,user_id,office_id), check((status='draft' and submitted_at is null) or (status<>'draft' and submitted_at is not null))
);
create index candidate_applications_user_idx on public.candidate_applications(user_id,created_at desc);
create index candidate_applications_review_idx on public.candidate_applications(election_id,status,submitted_at);
alter table public.candidate_applications add constraint applications_submission_minimums check (
 status='draft' or (submitted_at is not null and char_length(trim(biography))>=30 and char_length(trim(manifesto))>=80)
);
create table public.candidate_application_documents (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.candidate_applications(id) on delete cascade,
 storage_path text not null unique check(char_length(storage_path)<=500),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 byte_size integer not null check(byte_size between 1 and 2097152), uploaded_at timestamptz not null default now(), unique(application_id)
);
create index candidate_documents_app_idx on public.candidate_application_documents(application_id);
create table public.candidate_review_decisions (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.candidate_applications(id) on delete restrict,
 reviewer_id uuid not null references public.profiles(id) on delete restrict,
 decision public.application_status not null check(decision in ('approved','rejected')),
 reason text not null default '' check(char_length(reason)<=1000), decided_at timestamptz not null default now()
);
create index candidate_decisions_app_idx on public.candidate_review_decisions(application_id,decided_at desc);
create table public.verification_history (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
 request_id uuid references public.student_verification_requests(id) on delete set null, status public.review_status not null,
 reviewer_id uuid references public.profiles(id) on delete restrict, reason text not null default '' check(char_length(reason)<=1000),
 created_at timestamptz not null default now()
);
create index verification_history_user_idx on public.verification_history(user_id,created_at desc);
create table public.admin_audit_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
 action text not null check(char_length(action) between 1 and 80), entity_type text not null check(char_length(entity_type) between 1 and 80),
 entity_id uuid, election_id uuid references public.elections(id) on delete set null, reason text not null default '' check(char_length(reason)<=1000),
 created_at timestamptz not null default now()
);
create index admin_audit_election_idx on public.admin_audit_events(election_id,created_at desc);

create function public.protect_profile_fields() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user<>'postgres' and (new.id<>old.id or new.email<>old.email or new.registration_number is distinct from old.registration_number or new.verification_status<>old.verification_status) then raise exception 'Protected profile fields require an authorized workflow'; end if;
 new.updated_at:=now(); return new;
end $$;
create trigger profiles_protected before update on public.profiles for each row execute function public.protect_profile_fields();
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email,full_name) values(new.id,lower(new.email),left(coalesce(new.raw_user_meta_data->>'full_name',''),120)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create function public.handle_email_update() returns trigger language plpgsql security definer set search_path='' as $$
declare profile_row public.profiles%rowtype; still_eligible boolean;
begin
 if new.email is distinct from old.email then
  select * into profile_row from public.profiles where id=new.id;
  if not found then return new; end if;
  select exists(select 1 from public.eligible_students where registration_number=profile_row.registration_number and lower(verified_email)=lower(new.email) and roster_status='approved') into still_eligible;
  if profile_row.verification_status='verified' and not still_eligible then
   update public.profiles set email=lower(new.email),verification_status='revoked' where id=new.id;
   update public.student_verification_requests set status='revoked',reviewer_id=null,reason='Confirmed account email changed; student identity requires a new review',reviewed_at=now() where user_id=new.id and status='verified';
   update public.election_eligibility set status='revoked',decided_by=null,reason='Confirmed account email changed; student identity requires a new review',decided_at=now() where user_id=new.id and status='verified';
   insert into public.verification_history(user_id,status,reviewer_id,reason) values(new.id,'revoked',null,'Confirmed account email changed; student identity requires a new review');
   insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(null,'auth_email_changed','student_profile',new.id,'Identity and election eligibility revoked pending committee review');
  else update public.profiles set email=lower(new.email) where id=new.id; end if;
 end if; return new;
end $$;
create trigger on_auth_user_email_updated after update of email on auth.users for each row execute function public.handle_email_update();
create function public.has_committee_role(allowed public.committee_role[],scoped_election uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.committee_members cm where cm.user_id=(select auth.uid()) and cm.role=any(allowed) and (scoped_election is null or cm.election_id is null or cm.election_id=scoped_election));
$$;
revoke all on function public.has_committee_role(public.committee_role[],uuid) from public;
grant execute on function public.has_committee_role(public.committee_role[],uuid) to authenticated;

create function public.submit_verification_request(registration_number_input text) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'Verify your email before requesting verification'; end if;
 if registration_number_input is null or char_length(trim(registration_number_input)) not between 3 and 40 then raise exception 'Invalid registration number'; end if;
 insert into public.student_verification_requests(user_id,requested_registration_number) values(auth.uid(),upper(trim(registration_number_input)))
 on conflict(user_id) do update set requested_registration_number=excluded.requested_registration_number,status='pending',reviewer_id=null,reason=null,created_at=now(),reviewed_at=null
 where student_verification_requests.status in ('rejected','revoked') and student_verification_requests.created_at < now()-interval '15 minutes' returning id into result_id;
 if result_id is null then raise exception 'An active verification request already exists'; end if;
 update public.profiles set verification_status='pending' where id=auth.uid(); return result_id;
end $$;
revoke all on function public.submit_verification_request(text) from public,anon;
grant execute on function public.submit_verification_request(text) to authenticated;

create function public.decide_student_verification(request_id_input uuid,decision_input public.review_status,reason_input text default '') returns void language plpgsql security definer set search_path='' as $$
declare r public.student_verification_requests%rowtype; email_value text; roster_id uuid;
begin
 if not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if decision_input not in ('verified','rejected','revoked') or char_length(reason_input)>1000 or (decision_input in ('rejected','revoked') and char_length(trim(reason_input))<3) then raise exception 'Invalid decision or missing reason'; end if;
 select * into r from public.student_verification_requests where id=request_id_input for update;
 if not found or (r.status<>'pending' and decision_input<>'revoked') then raise exception 'Request cannot be decided'; end if;
 select lower(email) into email_value from public.profiles where id=r.user_id;
 if decision_input='verified' then
  select id into roster_id from public.eligible_students where registration_number=upper(trim(r.requested_registration_number)) and lower(verified_email)=email_value and roster_status='approved';
  if roster_id is null then raise exception 'No matching approved student record'; end if;
  update public.profiles set registration_number=upper(trim(r.requested_registration_number)),verification_status='verified' where id=r.user_id;
 else
  update public.profiles set verification_status=decision_input where id=r.user_id;
  if decision_input in('rejected','revoked') then
   update public.election_eligibility set status=decision_input,decided_by=auth.uid(),reason=left(trim(reason_input),1000),decided_at=now() where user_id=r.user_id and status='verified';
  end if;
 end if;
 update public.student_verification_requests set status=decision_input,reviewer_id=auth.uid(),reason=left(trim(reason_input),1000),reviewed_at=now() where id=r.id;
 insert into public.verification_history(user_id,request_id,status,reviewer_id,reason) values(r.user_id,r.id,decision_input,auth.uid(),left(trim(reason_input),1000));
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),decision_input::text,'student_verification_request',r.id,left(trim(reason_input),1000));
end $$;
revoke all on function public.decide_student_verification(uuid,public.review_status,text) from public,anon;
grant execute on function public.decide_student_verification(uuid,public.review_status,text) to authenticated;

create function public.decide_candidate_application(application_id_input uuid,decision_input public.application_status,reason_input text default '') returns void language plpgsql security definer set search_path='' as $$
declare a public.candidate_applications%rowtype;
begin
 select * into a from public.candidate_applications where id=application_id_input for update;
 if not found or not public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],a.election_id) then raise exception 'Not authorized'; end if;
 if a.status<>'submitted' or decision_input not in ('approved','rejected') or char_length(reason_input)>1000 or (decision_input='rejected' and char_length(trim(reason_input))<3) then raise exception 'Application cannot be decided or rejection reason missing'; end if;
 update public.candidate_applications set status=decision_input where id=a.id;
 insert into public.candidate_review_decisions(application_id,reviewer_id,decision,reason) values(a.id,auth.uid(),decision_input,left(trim(reason_input),1000));
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),decision_input::text,'candidate_application',a.id,a.election_id,left(trim(reason_input),1000));
end $$;
revoke all on function public.decide_candidate_application(uuid,public.application_status,text) from public,anon;
grant execute on function public.decide_candidate_application(uuid,public.application_status,text) to authenticated;

create function public.manage_committee_member(user_id_input uuid,role_input public.committee_role,election_id_input uuid,action_input text) returns void language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if user_id_input=auth.uid() then raise exception 'Committee members cannot change their own access'; end if;
 if action_input='add' then
  if role_input='committee_chair' then raise exception 'Committee chair provisioning requires trusted server administration'; end if;
  insert into public.committee_members(user_id,role,election_id,added_by) values(user_id_input,role_input,election_id_input,auth.uid());
 elsif action_input='remove' then delete from public.committee_members where user_id=user_id_input and role=role_input and election_id is not distinct from election_id_input and user_id<>auth.uid();
  get diagnostics affected = ROW_COUNT; if affected=0 then raise exception 'Committee assignment not found'; end if;
 else raise exception 'Invalid action'; end if;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'committee_member_'||action_input,'committee_member',user_id_input,election_id_input);
end $$;
revoke all on function public.manage_committee_member(uuid,public.committee_role,uuid,text) from public,anon;
grant execute on function public.manage_committee_member(uuid,public.committee_role,uuid,text) to authenticated;

create function public.import_eligible_students(rows_input jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare row_count integer; changed text[];
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if jsonb_typeof(rows_input)<>'array' or jsonb_array_length(rows_input) not between 1 and 250 then raise exception 'Invalid roster batch size'; end if;
 if exists(select 1 from jsonb_to_recordset(rows_input) as r(registration_number text,email text,status text)
  where r.registration_number is null or r.email is null or r.status not in('approved','withdrawn')
   or r.registration_number !~ '^[A-Z0-9/-]{3,40}$' or length(r.email)>254 or r.email !~* '^[^@ ]+@[^@ ]+[.][^@ ]+$') then raise exception 'Invalid roster row'; end if;
 if (select count(*) from jsonb_to_recordset(rows_input) as r(registration_number text,email text,status text)) <>
    (select count(distinct registration_number) from jsonb_to_recordset(rows_input) as r(registration_number text,email text,status text))
  or (select count(*) from jsonb_to_recordset(rows_input) as r(registration_number text,email text,status text)) <>
    (select count(distinct lower(email)) from jsonb_to_recordset(rows_input) as r(registration_number text,email text,status text)) then raise exception 'Duplicate roster entries'; end if;
 select array_agg(p.id::text) into changed from public.profiles p join public.eligible_students old on old.registration_number=p.registration_number
 join jsonb_to_recordset(rows_input) as r(registration_number text,email text,status text) on upper(trim(r.registration_number))=old.registration_number
 where p.verification_status='verified' and (lower(trim(r.email))<>lower(old.verified_email) or r.status='withdrawn');
 if changed is not null then
  insert into public.verification_history(user_id,status,reviewer_id,reason)
   select p.id,'revoked',auth.uid(),'Approved roster correction or withdrawal' from public.profiles p where p.id::text=any(changed);
  update public.election_eligibility set status='revoked',decided_by=auth.uid(),reason='Approved roster correction or withdrawal',decided_at=now()
   where user_id::text=any(changed) and status='verified';
  update public.profiles set verification_status='revoked' where id::text=any(changed);
 end if;
 insert into public.eligible_students(registration_number,verified_email,roster_status,imported_by)
 select upper(trim(r.registration_number)),lower(trim(r.email)),r.status,auth.uid()
 from jsonb_to_recordset(rows_input) as r(registration_number text,email text,status text)
 on conflict(registration_number) do update set verified_email=excluded.verified_email,roster_status=excluded.roster_status,imported_by=excluded.imported_by,imported_at=now();
 get diagnostics row_count = ROW_COUNT;
 insert into public.admin_audit_events(actor_id,action,entity_type,reason) values(auth.uid(),'roster_import','eligible_students',row_count::text||' rows');
 return row_count;
end $$;
revoke all on function public.import_eligible_students(jsonb) from public,anon;
grant execute on function public.import_eligible_students(jsonb) to authenticated;

create function public.create_election(election_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; offices text[]; title_value text; description_value text; nstart timestamptz; nend timestamptz; vstart timestamptz; vend timestamptz;
begin
 if not public.has_committee_role(array['election_administrator','committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 title_value:=trim(election_input->>'title'); description_value:=coalesce(election_input->>'description','');
 nstart:=(election_input->>'nominationsStart')::timestamptz; nend:=(election_input->>'nominationsEnd')::timestamptz;
 vstart:=(election_input->>'votingStart')::timestamptz; vend:=(election_input->>'votingEnd')::timestamptz;
 select array_agg(trim(value) order by ordinality) into offices from jsonb_array_elements_text(election_input->'offices') with ordinality as x(value,ordinality);
 if char_length(title_value) not between 5 and 120 or char_length(description_value)>1500 or nstart>=nend or nend>=vstart or vstart>=vend or coalesce(array_length(offices,1),0) not between 1 and 20 then raise exception 'Invalid election configuration'; end if;
 if exists(select 1 from unnest(offices) x where char_length(x) not between 2 and 80) or cardinality(offices)<>(select count(distinct x) from unnest(offices) x) then raise exception 'Invalid office list'; end if;
 insert into public.elections(title,description,nominations_start,nominations_end,voting_start,voting_end,created_by)
 values(title_value,description_value,nstart,nend,vstart,vend,auth.uid()) returning id into new_id;
 insert into public.election_offices(election_id,title,display_order) select new_id,office,(ordinality-1)::smallint from unnest(offices) with ordinality x(office,ordinality);
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'created','election',new_id,new_id);
 return new_id;
end $$;
revoke all on function public.create_election(jsonb) from public,anon;
grant execute on function public.create_election(jsonb) to authenticated;

create function public.prepare_election(election_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_committee_role(array['election_administrator','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 update public.elections set status='prepared' where id=election_id_input and status='draft'
  and exists(select 1 from public.election_offices o where o.election_id=election_id_input);
 if not found then raise exception 'Election cannot be prepared'; end if;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'prepared','election',election_id_input,election_id_input);
end $$;
revoke all on function public.prepare_election(uuid) from public,anon;
grant execute on function public.prepare_election(uuid) to authenticated;

create function public.decide_election_eligibility(election_id_input uuid,user_id_input uuid,decision_input public.review_status,reason_input text default '') returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 if decision_input not in('verified','rejected','revoked') or char_length(reason_input)>1000 or (decision_input in('rejected','revoked') and char_length(trim(reason_input))<3) then raise exception 'Invalid decision or missing reason'; end if;
 if decision_input='verified' and not exists(select 1 from public.profiles where id=user_id_input and verification_status='verified') then raise exception 'Student identity must be verified first'; end if;
 insert into public.election_eligibility(election_id,user_id,status,decided_by,reason,decided_at)
 values(election_id_input,user_id_input,decision_input,auth.uid(),left(trim(reason_input),1000),now())
 on conflict(election_id,user_id) do update set status=excluded.status,decided_by=excluded.decided_by,reason=excluded.reason,decided_at=excluded.decided_at;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id,reason) values(auth.uid(),decision_input::text,'election_eligibility',user_id_input,election_id_input,left(trim(reason_input),1000));
end $$;
revoke all on function public.decide_election_eligibility(uuid,uuid,public.review_status,text) from public,anon;
grant execute on function public.decide_election_eligibility(uuid,uuid,public.review_status,text) to authenticated;

alter table public.profiles enable row level security; alter table public.profiles force row level security;
create policy "profiles_select_self" on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy "profiles_select_officers" on public.profiles for select to authenticated using(public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]));
create policy "profiles_update_self" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
revoke all on public.profiles from anon,authenticated; grant select on public.profiles to authenticated; grant update(full_name) on public.profiles to authenticated;

alter table public.committee_members enable row level security; alter table public.committee_members force row level security;
create policy "committee_read_self" on public.committee_members for select to authenticated using(user_id=(select auth.uid()));
create policy "committee_chair_read_all" on public.committee_members for select to authenticated using(public.has_committee_role(array['committee_chair']::public.committee_role[]));
revoke all on public.committee_members from anon,authenticated; grant select on public.committee_members to authenticated;
alter table public.eligible_students enable row level security; alter table public.eligible_students force row level security;
create policy "roster_chair_read" on public.eligible_students for select to authenticated using(public.has_committee_role(array['committee_chair']::public.committee_role[]));
revoke all on public.eligible_students from anon,authenticated; grant select on public.eligible_students to authenticated;

alter table public.student_verification_requests enable row level security; alter table public.student_verification_requests force row level security;
create policy "verification_read_self" on public.student_verification_requests for select to authenticated using(user_id=(select auth.uid()));
create policy "verification_read_officers" on public.student_verification_requests for select to authenticated using(public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]));
revoke all on public.student_verification_requests from anon,authenticated; grant select on public.student_verification_requests to authenticated;

alter table public.elections enable row level security; alter table public.elections force row level security;
create policy "elections_authenticated_read" on public.elections for select to authenticated using(true);
revoke all on public.elections from anon,authenticated; grant select on public.elections to authenticated;

alter table public.election_offices enable row level security; alter table public.election_offices force row level security;
create policy "offices_authenticated_read" on public.election_offices for select to authenticated using(true);
revoke all on public.election_offices from anon,authenticated; grant select on public.election_offices to authenticated;

alter table public.election_eligibility enable row level security; alter table public.election_eligibility force row level security;
create policy "eligibility_read_self" on public.election_eligibility for select to authenticated using(user_id=(select auth.uid()));
create policy "eligibility_officers_read" on public.election_eligibility for select to authenticated using(public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[],election_id));
revoke all on public.election_eligibility from anon,authenticated; grant select on public.election_eligibility to authenticated;

alter table public.candidate_applications enable row level security; alter table public.candidate_applications force row level security;
create policy "applications_read_own" on public.candidate_applications for select to authenticated using(user_id=(select auth.uid()));
create policy "applications_read_reviewers" on public.candidate_applications for select to authenticated using(public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],election_id));
create view public.candidate_review_queue with (security_barrier=true) as
 select a.id,a.election_id,a.office_id,a.user_id,a.biography,a.manifesto,a.status,a.submitted_at,p.full_name,o.title as office_title,e.title as election_title
 from public.candidate_applications a join public.profiles p on p.id=a.user_id
 join public.election_offices o on o.id=a.office_id join public.elections e on e.id=a.election_id
 where a.status in('submitted','approved','rejected') and public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],a.election_id);
grant select on public.candidate_review_queue to authenticated;
create policy "applications_insert_own" on public.candidate_applications for insert to authenticated with check(user_id=(select auth.uid()) and status='draft'
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.verification_status='verified')
 and exists(select 1 from public.election_eligibility ee where ee.user_id=auth.uid() and ee.election_id=candidate_applications.election_id and ee.status='verified')
 and exists(select 1 from public.elections e where e.id=candidate_applications.election_id and e.status in('draft','prepared') and now() between e.nominations_start and e.nominations_end)
 and exists(select 1 from public.election_offices o where o.id=candidate_applications.office_id and o.election_id=candidate_applications.election_id));
revoke all on public.candidate_applications from anon,authenticated; grant select on public.candidate_applications to authenticated;
grant insert(election_id,office_id,user_id,biography,manifesto,status,submitted_at) on public.candidate_applications to authenticated;

create function public.submit_candidate_application(application_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.candidate_applications%rowtype;
begin
 select * into a from public.candidate_applications where id=application_id_input and user_id=auth.uid() for update;
 if not found or a.status<>'draft' then raise exception 'Draft application not found'; end if;
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.verification_status='verified') then raise exception 'Student verification required'; end if;
 if not exists(select 1 from public.election_eligibility ee where ee.user_id=auth.uid() and ee.election_id=a.election_id and ee.status='verified') then raise exception 'Election eligibility required'; end if;
 if not exists(select 1 from public.elections e where e.id=a.election_id and e.status in('draft','prepared') and now() between e.nominations_start and e.nominations_end) then raise exception 'Nomination period is closed'; end if;
 if char_length(trim(a.biography))<30 or char_length(trim(a.manifesto))<80 then raise exception 'Application fields are incomplete'; end if;
 update public.candidate_applications set status='submitted',submitted_at=now() where id=a.id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'submitted','candidate_application',a.id,a.election_id);
end $$;
revoke all on function public.submit_candidate_application(uuid) from public,anon;
grant execute on function public.submit_candidate_application(uuid) to authenticated;

create function public.record_candidate_photo_upload(application_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.candidate_applications a join public.candidate_application_documents d on d.application_id=a.id where a.id=application_id_input and a.user_id=auth.uid() and a.status='draft') then raise exception 'Photo is not attached to your draft'; end if;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'photo_uploaded','candidate_application',application_id_input);
end $$;
revoke all on function public.record_candidate_photo_upload(uuid) from public,anon;
grant execute on function public.record_candidate_photo_upload(uuid) to authenticated;

alter table public.candidate_application_documents enable row level security; alter table public.candidate_application_documents force row level security;
create policy "documents_read_owner_reviewer" on public.candidate_application_documents for select to authenticated using(exists(select 1 from public.candidate_applications a where a.id=application_id and (a.user_id=auth.uid() or public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],a.election_id))));
create policy "documents_insert_owner" on public.candidate_application_documents for insert to authenticated with check(exists(select 1 from public.candidate_applications a where a.id=application_id and a.user_id=auth.uid() and a.status in('draft','submitted')) and storage_path like auth.uid()::text||'/'||application_id::text||'/%');
revoke all on public.candidate_application_documents from anon,authenticated; grant select on public.candidate_application_documents to authenticated;

alter table public.candidate_review_decisions enable row level security; alter table public.candidate_review_decisions force row level security;
create policy "decisions_read_related" on public.candidate_review_decisions for select to authenticated using(reviewer_id=auth.uid() or exists(select 1 from public.candidate_applications a where a.id=application_id and (a.user_id=auth.uid() or public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],a.election_id))));
revoke all on public.candidate_review_decisions from anon,authenticated; grant select on public.candidate_review_decisions to authenticated;
alter table public.verification_history enable row level security; alter table public.verification_history force row level security;
create policy "history_read_related" on public.verification_history for select to authenticated using(user_id=auth.uid() or public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]));
revoke all on public.verification_history from anon,authenticated; grant select on public.verification_history to authenticated;
alter table public.admin_audit_events enable row level security; alter table public.admin_audit_events force row level security;
create policy "audit_read_admins" on public.admin_audit_events for select to authenticated using(public.has_committee_role(array['committee_chair','election_administrator']::public.committee_role[],election_id));
revoke all on public.admin_audit_events from anon,authenticated; grant select on public.admin_audit_events to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('candidate-private','candidate-private',false,2097152,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
-- Uploads use a server-only Storage client after verifying the owner session and application.
create policy "download_owned_or_assigned_files" on storage.objects for select to authenticated using(bucket_id='candidate-private' and exists(select 1 from public.candidate_applications a where a.id::text=(storage.foldername(name))[2]
 and ((storage.foldername(name))[1]=a.user_id::text and a.user_id=auth.uid() or public.has_committee_role(array['candidate_review_officer','committee_chair']::public.committee_role[],a.election_id))));
create policy "delete_own_draft_files" on storage.objects for delete to authenticated using(bucket_id='candidate-private' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.candidate_applications a where a.id::text=(storage.foldername(name))[2] and a.user_id=auth.uid() and a.status='draft'));

