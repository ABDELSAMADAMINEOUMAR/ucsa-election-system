create function public.propose_membership_change(register_input uuid,registration_input text,name_input text,email_input text,action_input text,reason_input text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.official_registers%rowtype; rows_value jsonb; result uuid; person uuid;
begin
 if not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 if action_input not in('add','withdraw','reinstate') or length(trim(reason_input)) not between 10 and 1000 then raise exception 'Documented correction required'; end if;
 select * into r from public.official_registers where id=register_input and status='locked';
 if not found then raise exception 'Register unavailable'; end if;
 select identity_id into person from public.official_register_entries where register_id=r.id and registration_number=upper(trim(registration_input));
 if action_input='add' then
  if person is not null then raise exception 'Record already exists'; end if;
  rows_value:=r.rows_snapshot||jsonb_build_array(jsonb_build_object('fullName',trim(name_input),'registrationNumber',upper(trim(registration_input)),'email',lower(trim(email_input))));
 elsif action_input='withdraw' then
  if person is null then raise exception 'Record unavailable'; end if;
  select jsonb_agg(x order by n) into rows_value from jsonb_array_elements(r.rows_snapshot) with ordinality as t(x,n) where x->>'registrationNumber'<>upper(trim(registration_input));
 else
  if person is null or not exists(select 1 from public.voter_identities where id=person and status in('suspended','revoked')) then raise exception 'Restricted identity not found'; end if;
  select jsonb_agg(case when x->>'registrationNumber'=upper(trim(registration_input)) then x||jsonb_build_object('identityId',person,'identityStatus','active') else x end order by n) into rows_value from jsonb_array_elements(r.rows_snapshot) with ordinality as t(x,n);
 end if;
 if rows_value is null or jsonb_array_length(rows_value) not between 1 and 5000 then raise exception 'Register must retain 1–5,000 entries'; end if;
 insert into public.official_registers(title,classification,parent_id,reason,membership_opens,membership_closes,activation_opens,activation_closes,file_name,source_sha256,rows_snapshot,snapshot_sha256,request_key,created_by)
 values(r.title,r.classification,r.id,action_input||': '||trim(reason_input),r.membership_opens,r.membership_closes,r.activation_opens,r.activation_closes,'membership-change.json',encode(extensions.digest(rows_value::text,'sha256'),'hex'),rows_value,encode(extensions.digest(rows_value::text,'sha256'),'hex'),gen_random_uuid(),auth.uid()) returning id into result;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),'membership_change_proposed','official_register',result,action_input||': '||left(trim(reason_input),900));
 return result;
end $$;
revoke all on function public.propose_membership_change(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.propose_membership_change(uuid,text,text,text,text,text) to authenticated;
do $$ declare definition text; begin
 select pg_get_functiondef('public.checked_approve_official_register(uuid,text)'::regprocedure) into definition;
 definition:=replace(definition,'insert into public.official_register_entries values(r.id,person,',E'if row_value->>''identityStatus''=''active'' then\n if r.parent_id is null or r.created_by=auth.uid() then raise exception ''Independent reinstatement approval required''; end if;\n update public.voter_identities set status=''active'' where id=person;\n insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,reason) values(auth.uid(),''membership_reinstated'',''voter_identity'',person,left(r.reason,1000));\n end if;\n insert into public.official_register_entries values(r.id,person,');
 execute definition;
end $$;
