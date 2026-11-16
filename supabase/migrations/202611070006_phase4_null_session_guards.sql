create or replace function public.get_complaint_details(complaint_id_input uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.complaints%rowtype; reviewer boolean; result jsonb;
begin
 if auth.uid() is null then raise exception 'Complaint unavailable'; end if;
 select * into c from public.complaints where id=complaint_id_input;
 if not found then raise exception 'Complaint unavailable'; end if;
 reviewer:=public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id);
 if c.student_id is distinct from auth.uid() and not reviewer then raise exception 'Complaint unavailable'; end if;
 select jsonb_build_object('complaint',jsonb_build_object('id',c.id,'reference',c.reference_code,'electionId',c.election_id,'electionTitle',(select title from public.elections where id=c.election_id),'category',c.category,'description',c.description,'status',c.status,'createdAt',c.created_at,'updatedAt',c.updated_at,'assignedTo',case when reviewer then c.assigned_to else null end,'studentName',case when reviewer then (select full_name from public.profiles where id=c.student_id) else null end),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',ev.id,'type',ev.event_type,'fromStatus',ev.from_status,'toStatus',ev.to_status,'publicNote',ev.public_note,'internalNote',case when reviewer then ev.internal_note else null end,'actorId',case when reviewer then ev.actor_id else null end,'createdAt',ev.created_at) order by ev.created_at,ev.id) from public.complaint_events ev where ev.complaint_id=c.id and (reviewer or ev.public_note is not null)),'[]'::jsonb),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'fileName',d.file_name,'mimeType',d.mime_type,'uploadedAt',d.uploaded_at) order by d.uploaded_at) from public.complaint_documents d where d.complaint_id=c.id),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function public.get_complaint_document_path(complaint_id_input uuid,document_id_input uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare c public.complaints%rowtype; storage_path_value text;
begin
 if auth.uid() is null then raise exception 'Evidence unavailable'; end if;
 select * into c from public.complaints where id=complaint_id_input;
 if not found or (c.student_id is distinct from auth.uid() and not public.has_committee_role(array['certifying_officer','committee_chair']::public.committee_role[],c.election_id)) then raise exception 'Evidence unavailable'; end if;
 select d.storage_path into storage_path_value from public.complaint_documents d where d.id=document_id_input and d.complaint_id=complaint_id_input;
 if storage_path_value is null then raise exception 'Evidence unavailable'; end if;
 return storage_path_value;
end $$;
