-- Additive local administration support. No existing decisions/roles/elections change.
alter table public.eligible_students
  add column full_name text not null default '' check (char_length(full_name)<=120),
  add column academic_program text not null default '' check (char_length(academic_program)<=120);

create function public.import_roster_details(rows_input jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare imported integer;
begin
 if not public.is_active_session() or not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if jsonb_typeof(rows_input) is distinct from 'array' or jsonb_array_length(rows_input) not between 1 and 250 then raise exception 'Invalid roster batch'; end if;
 if exists(select 1 from jsonb_to_recordset(rows_input) r(full_name text,academic_program text) where char_length(coalesce(r.full_name,''))>120 or char_length(coalesce(r.academic_program,''))>120) then raise exception 'Invalid roster metadata'; end if;
 -- Serialize writes and reject a stale/missing preview rather than silently
 -- overwriting another officer's corrected official roster.
 lock table public.eligible_students in share row exclusive mode;
 if exists(select 1 from jsonb_array_elements(rows_input) x
  left join public.eligible_students s on s.registration_number=upper(trim(x->>'registration_number'))
  where not(x ? 'expected') or (s.id is null and x->'expected' is distinct from 'null'::jsonb)
   or (s.id is not null and x->'expected' is distinct from jsonb_build_object('email',s.verified_email,'status',s.roster_status,'fullName',s.full_name,'academicProgram',s.academic_program))) then raise exception 'Roster preview changed; review again'; end if;
 -- Retain the existing validation, correction/revocation, uniqueness and audit path.
 imported:=public.import_eligible_students(rows_input);
 update public.eligible_students s set full_name=coalesce(r.full_name,s.full_name),academic_program=coalesce(r.academic_program,s.academic_program)
 from jsonb_to_recordset(rows_input) r(registration_number text,full_name text,academic_program text)
 where s.registration_number=upper(trim(r.registration_number));
 return imported;
end $$;
revoke all on function public.import_roster_details(jsonb) from public,anon,authenticated;
grant execute on function public.import_roster_details(jsonb) to authenticated;

-- Reviewers get matching outcomes for authorized requests, never the private roster.
create function public.review_verification_queue(page_input integer default 1,size_input integer default 25,search_input text default '',status_input text default 'pending')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_active_session() or not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if page_input is null or page_input not between 1 and 100000 or size_input is null or size_input not between 1 and 100 or search_input is null or char_length(search_input)>120 or status_input is null or status_input not in('all','pending','verified','rejected','revoked') then raise exception 'Invalid queue filters'; end if;
 with filtered as (
  select r.id,r.user_id,r.requested_registration_number,r.status,r.created_at,r.reviewed_at,r.reason,p.full_name,p.email,
   case
    when u.email_confirmed_at is null or u.deleted_at is not null or (u.banned_until is not null and u.banned_until>now()) or lower(u.email) is distinct from lower(p.email) then 'account_unconfirmed'
    when exists(select 1 from public.student_verification_requests other where other.id<>r.id and other.status='pending' and upper(trim(other.requested_registration_number))=upper(trim(r.requested_registration_number))) then 'duplicate'
    when exists(select 1 from public.eligible_students s where s.registration_number=upper(trim(r.requested_registration_number)) and lower(s.verified_email)=lower(p.email) and s.roster_status='approved') then 'matched'
    else 'unmatched' end as match_status
  from public.student_verification_requests r join public.profiles p on p.id=r.user_id join auth.users u on u.id=r.user_id
  where (status_input='all' or r.status::text=status_input)
    and (search_input='' or position(lower(trim(search_input)) in lower(p.full_name||' '||p.email||' '||r.requested_registration_number))>0)
 ), paged as (select * from filtered order by created_at desc,id limit size_input offset ((page_input-1)*size_input))
 select jsonb_build_object('total',(select count(*) from filtered),'records',coalesce((select jsonb_agg(to_jsonb(paged) order by created_at desc,id) from paged),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.review_verification_queue(integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.review_verification_queue(integer,integer,text,text) to authenticated;

create function public.bulk_decide_student_verification(ids_input uuid[],decision_input public.review_status,reason_input text default '')
returns table(request_id uuid,success boolean,error_code text)
language plpgsql security definer set search_path='' as $$
declare rid uuid; r public.student_verification_requests%rowtype; profile_email text; auth_email text; confirmed timestamptz; roster_id uuid;
begin
 if not public.is_active_session() or not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if ids_input is null or cardinality(ids_input) not between 1 and 100 or array_position(ids_input,null) is not null
   or cardinality(ids_input)<>(select count(distinct x) from unnest(ids_input) x)
   or decision_input is null or decision_input not in('verified','rejected') or reason_input is null or char_length(reason_input)>1000 or (decision_input='rejected' and char_length(trim(reason_input))<3) then raise exception 'Invalid bulk decision'; end if;
 -- Stable lock order plus per-record subtransactions. Failure rolls back that
 -- record's profile/history/audit changes; other valid decisions can succeed.
 for rid in select x from unnest(ids_input) x order by x loop
  request_id:=rid; success:=false; error_code:=null;
  begin
   select * into r from public.student_verification_requests where id=rid for update;
   if not found or r.status<>'pending' then
    error_code:='not_pending';
   else
    if decision_input='verified' then
     select lower(p.email) into profile_email from public.profiles p where p.id=r.user_id for update;
     select lower(u.email),u.email_confirmed_at into auth_email,confirmed from auth.users u where u.id=r.user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
     select s.id into roster_id from public.eligible_students s where s.registration_number=upper(trim(r.requested_registration_number)) and lower(s.verified_email)=profile_email and s.roster_status='approved' for share;
     if confirmed is null or auth_email is distinct from profile_email or roster_id is null then error_code:='unmatched'; end if;
     if exists(select 1 from public.student_verification_requests other where other.id<>rid and other.status='pending' and upper(trim(other.requested_registration_number))=upper(trim(r.requested_registration_number))) then error_code:='duplicate'; end if;
    end if;
    if error_code is null then
     -- Existing decision function retains authorization, row-state checks,
     -- identity matching, responsible officer, history and audit timestamp.
     perform public.decide_student_verification(rid,decision_input,reason_input);
     success:=true;
    end if;
   end if;
  exception when others then success:=false; error_code:='conflict';
  end;
  return next;
 end loop;
end $$;
revoke all on function public.bulk_decide_student_verification(uuid[],public.review_status,text) from public,anon,authenticated;
grant execute on function public.bulk_decide_student_verification(uuid[],public.review_status,text) to authenticated;

create function public.bulk_decide_election_eligibility(election_input uuid,ids_input uuid[],decision_input public.review_status,reason_input text default '')
returns table(request_id uuid,success boolean,error_code text)
language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not public.is_active_session() or not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[],election_input) then raise exception 'Not authorized'; end if;
 if ids_input is null or cardinality(ids_input) not between 1 and 100 or array_position(ids_input,null) is not null
  or cardinality(ids_input)<>(select count(distinct x) from unnest(ids_input) x) or decision_input is null or decision_input not in('verified','rejected')
  or reason_input is null or char_length(reason_input)>1000 or (decision_input='rejected' and char_length(trim(reason_input))<3) then raise exception 'Invalid bulk eligibility'; end if;
 -- Serialize with election opening and other eligibility batches. Existing
 -- decision/trigger functions remain authoritative about frozen windows.
 perform id from public.elections where id=election_input for update;
 if not found then raise exception 'Election unavailable'; end if;
 for rid in select x from unnest(ids_input) x order by x loop
  request_id:=rid;success:=false;error_code:=null;
  begin
   if exists(select 1 from public.election_eligibility where election_id=election_input and user_id=rid and status=decision_input) then error_code:='not_pending';
   else
    perform public.decide_election_eligibility(election_input,rid,decision_input,reason_input);
    success:=true;
   end if;
  exception when others then success:=false;error_code:='conflict_or_ineligible';
  end;
  return next;
 end loop;
end $$;
revoke all on function public.bulk_decide_election_eligibility(uuid,uuid[],public.review_status,text) from public,anon,authenticated;
grant execute on function public.bulk_decide_election_eligibility(uuid,uuid[],public.review_status,text) to authenticated;
