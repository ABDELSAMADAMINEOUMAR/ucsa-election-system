-- Serialize publication with election state and return the existing committed
-- publication on a retry, including its original timestamp and reference.
create or replace function public.publish_certified_election_results(election_id_input uuid,certification_id_input uuid,note_input text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare version_no integer; pub_id uuid; pub_time timestamptz;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[],election_id_input) then raise exception 'Not authorized'; end if;
 perform 1 from public.elections where id=election_id_input for update;
 if char_length(note_input)>500 or not exists(select 1 from public.election_certifications c join public.elections e on e.id=c.election_id where c.id=certification_id_input and c.election_id=election_id_input and e.status='certified') then raise exception 'Publication prerequisites are not satisfied'; end if;
 select id,publication_version,published_at into pub_id,version_no,pub_time from public.election_publications
 where election_id=election_id_input and certification_id=certification_id_input order by publication_version desc limit 1;
 if pub_id is not null then return jsonb_build_object('publicationId',pub_id,'version',version_no,'publishedAt',pub_time); end if;
 select coalesce(max(publication_version),0)+1 into version_no from public.election_publications where election_id=election_id_input;
 insert into public.election_publications(election_id,certification_id,publication_version,published_by,publication_note)
 values(election_id_input,certification_id_input,version_no,auth.uid(),trim(note_input)) returning id,published_at into pub_id,pub_time;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'results_published','election_publication',pub_id,election_id_input);
 return jsonb_build_object('publicationId',pub_id,'version',version_no,'publishedAt',pub_time);
end $$;
