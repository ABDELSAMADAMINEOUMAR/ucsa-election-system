-- Reviewers can propose a source they already hold, and see only their own
-- staged upload. Approved source snapshots and approval authority stay private
-- to the global chair. This enables independent successor approval in practice.
do $$ declare definition text; begin
 select pg_get_functiondef('public.stage_official_register(jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'array[''committee_chair'']::public.committee_role[]','array[''verification_officer'',''committee_chair'']::public.committee_role[]');
 execute definition;
end $$;
alter function public.stage_official_register(jsonb) rename to checked_stage_official_register;
revoke all on function public.checked_stage_official_register(jsonb) from public,anon,authenticated;
create function public.stage_official_register(input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; head uuid; row_value public.official_registers%rowtype; why text:=trim(coalesce(input->>'reason',''));
begin
 if not public.has_committee_role(array['verification_officer','committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(140002);
 result:=public.checked_stage_official_register(input);
 select * into row_value from public.official_registers where id=result;
 if row_value.status='locked' then return result; end if;
 select id into head from public.official_registers where status='locked' and classification='synthetic' order by approved_at desc,id desc limit 1;
 if head is not null then
  if length(why) not between 10 and 1000 then raise exception 'Documented successor reason required'; end if;
  if row_value.parent_id is not null and (row_value.parent_id<>head or row_value.reason<>why) then raise exception 'Stale successor upload'; end if;
  update public.official_registers set parent_id=head,reason=why where id=result;
 end if;
 return result;
end $$;
revoke all on function public.stage_official_register(jsonb) from public,anon;
grant execute on function public.stage_official_register(jsonb) to authenticated;
create policy reviewer_own_staging on public.official_registers for select to authenticated using(status='staging' and created_by=auth.uid() and public.has_committee_role(array['verification_officer']::public.committee_role[]));
do $$ declare definition text; begin
 select pg_get_functiondef('public.get_register_preview(uuid,integer)'::regprocedure) into definition;
 definition:=replace(definition,'if not public.has_committee_role(array[''committee_chair'']::public.committee_role[]) or page_input not between 1 and 200 then',
 'if (not public.has_committee_role(array[''committee_chair'']::public.committee_role[]) and not exists(select 1 from public.official_registers own_upload where own_upload.id=register_input and own_upload.status=''staging'' and own_upload.created_by=auth.uid() and public.has_committee_role(array[''verification_officer'']::public.committee_role[]))) or page_input not between 1 and 200 then');
 execute definition;
end $$;
