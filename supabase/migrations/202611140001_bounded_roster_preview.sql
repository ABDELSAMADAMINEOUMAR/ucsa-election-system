-- Keep batch identifiers in a bounded POST body rather than very long REST
-- filter URLs. This is read-only and exposes no records to non-chair users.
create function public.preview_roster_records(rows_input jsonb)
returns table(registration_number text,verified_email text,roster_status text,full_name text,academic_program text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_active_session() or not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if jsonb_typeof(rows_input) is distinct from 'array' or jsonb_array_length(rows_input) not between 1 and 250 then raise exception 'Invalid preview batch'; end if;
 if exists(select 1 from jsonb_to_recordset(rows_input) r(registration_number text,email text) where r.registration_number is null or char_length(r.registration_number)>40 or r.email is null or char_length(r.email)>254) then raise exception 'Invalid preview identifiers'; end if;
 return query select s.registration_number,s.verified_email,s.roster_status,s.full_name,s.academic_program
 from public.eligible_students s where exists(select 1 from jsonb_to_recordset(rows_input) r(registration_number text,email text) where s.registration_number=upper(trim(r.registration_number)) or lower(s.verified_email)=lower(trim(r.email)));
end $$;
revoke all on function public.preview_roster_records(jsonb) from public,anon,authenticated;
grant execute on function public.preview_roster_records(jsonb) to authenticated;
