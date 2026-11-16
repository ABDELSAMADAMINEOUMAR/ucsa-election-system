create function public.get_register_preview(register_input uuid,page_input integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.official_registers%rowtype; validation jsonb;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[]) or page_input not between 1 and 200 then raise exception 'Not authorized'; end if;
 select * into r from public.official_registers where id=register_input;
 if not found then raise exception 'Register unavailable'; end if;
 validation:=public.register_validation(r.rows_snapshot);
 return jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'fileName',r.file_name,'snapshot',r.snapshot_sha256,'sourceSha256',r.source_sha256,'reason',r.reason,'parent',r.parent_id,
  'total',jsonb_array_length(validation),'invalid',(select count(*) from jsonb_array_elements(validation) x where jsonb_array_length(x->'errors')>0),
  'conflicts',(select count(*) from jsonb_array_elements(r.rows_snapshot) x join public.voter_identifiers em on em.kind='email' and em.value=x->>'email' left join public.voter_identifiers rg on rg.kind='registration' and rg.value=x->>'registrationNumber' where em.identity_id is distinct from coalesce((x->>'identityId')::uuid,rg.identity_id)),
  'rows',(select coalesce(jsonb_agg(value),'[]'::jsonb) from (select value from jsonb_array_elements(validation) with ordinality where ordinality>(page_input-1)*25 and ordinality<=page_input*25) p));
end $$;
create function public.list_register_choices() returns table(id uuid,title text,record_count bigint) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_active_session() or not exists(select 1 from public.committee_members where user_id=auth.uid() and role in('verification_officer','election_administrator','committee_chair')) then raise exception 'Not authorized'; end if;
 return query select r.id,r.title,count(re.identity_id) from public.official_registers r join public.official_register_entries re on re.register_id=r.id where r.status='locked' and r.classification='synthetic' group by r.id order by r.approved_at desc;
end $$;
revoke all on function public.get_register_preview(uuid,integer),public.list_register_choices() from public,anon;
grant execute on function public.get_register_preview(uuid,integer),public.list_register_choices() to authenticated;

-- Student-owned private metadata and definer paths also require current binding.
create policy register_candidate_documents on public.candidate_application_documents as restrictive for select to authenticated using(
 public.has_student_access() or exists(select 1 from public.candidate_applications a where a.id=application_id and public.has_committee_role(array['committee_chair','candidate_review_officer']::public.committee_role[],a.election_id)));
create policy register_candidate_reviews on public.candidate_review_decisions as restrictive for select to authenticated using(
 public.has_student_access() or exists(select 1 from public.candidate_applications a where a.id=application_id and public.has_committee_role(array['committee_chair','candidate_review_officer']::public.committee_role[],a.election_id)));
create policy register_complaint_events on public.complaint_events as restrictive for select to authenticated using(
 public.has_student_access() or exists(select 1 from public.complaints c where c.id=complaint_id and public.has_committee_role(array['committee_chair','certifying_officer']::public.committee_role[],c.election_id)));
create policy register_complaint_documents on public.complaint_documents as restrictive for select to authenticated using(
 public.has_student_access() or exists(select 1 from public.complaints c where c.id=complaint_id and public.has_committee_role(array['committee_chair','certifying_officer']::public.committee_role[],c.election_id)));
do $$ declare f record; definition text; guarded text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('get_complaint_details','get_complaint_document_path') loop
  definition:=pg_get_functiondef(f.oid);
  guarded:=regexp_replace(definition,'\mbegin\M',E'begin\n if not public.has_student_access() and not exists(select 1 from public.complaints c where c.id=complaint_id_input and public.has_committee_role(array[''committee_chair'',''certifying_officer'']::public.committee_role[],c.election_id)) then raise exception ''Not authorized''; end if;','i');
  if guarded=definition then raise exception 'Missing private metadata guard'; end if; execute guarded;
 end loop;
end $$;
