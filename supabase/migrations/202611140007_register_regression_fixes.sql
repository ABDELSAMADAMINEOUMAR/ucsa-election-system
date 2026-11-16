-- Avoid variable/SQL-alias ambiguity in the additional private metadata guard.
do $$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('get_complaint_details','get_complaint_document_path') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'from public.complaints c where c.id=complaint_id_input and public.has_committee_role(array[''committee_chair'',''certifying_officer'']::public.committee_role[],c.election_id)','from public.complaints guarded_case where guarded_case.id=complaint_id_input and public.has_committee_role(array[''committee_chair'',''certifying_officer'']::public.committee_role[],guarded_case.election_id)');
  execute definition;
 end loop;
 select pg_get_functiondef('public.submit_election_ballot(uuid,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'begin',E'begin\n if selections_input is null or jsonb_typeof(selections_input)<>''array'' then raise exception ''Invalid ballot''; end if;');
 execute definition;
end $$;
create or replace function public.enforce_candidate_register() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)='authenticated' and auth.uid() is not null and new.user_id=auth.uid() and not public.has_election_student_access(new.election_id) then raise exception 'Election eligibility required'; end if;
 return new;
end $$;
