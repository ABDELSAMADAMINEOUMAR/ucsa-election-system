grant select(student_id) on public.complaints to authenticated;
revoke select(actor_id) on public.complaint_events from authenticated;

create or replace function public.reply_to_complaint(complaint_id_input uuid,message_input text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.complaints%rowtype;
begin
 select * into c from public.complaints where id=complaint_id_input and student_id=auth.uid() for update;
 if not found or c.status<>'awaiting_information' or char_length(trim(message_input)) not between 3 and 3000 then raise exception 'Complaint reply unavailable'; end if;
 insert into public.complaint_events(complaint_id,actor_id,event_type,from_status,to_status,public_note) values(c.id,auth.uid(),'student_reply',c.status,'under_review',trim(message_input));
 update public.complaints set status='under_review',updated_at=now() where id=c.id;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'complaint_student_replied','complaint',c.id,c.election_id);
end $$;

create or replace function public.record_complaint_document(complaint_id_input uuid,path_input text,file_name_input text,mime_input text,size_input integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; election_key uuid;
begin
 if not exists(select 1 from public.complaints c where c.id=complaint_id_input and c.student_id=auth.uid() and c.status in('submitted','under_review','awaiting_information') and path_input like c.student_id::text||'/'||c.id::text||'/%') then raise exception 'Evidence upload is not allowed'; end if;
 if mime_input not in('image/jpeg','image/png','image/webp','application/pdf') or size_input not between 1 and 5242880 or char_length(file_name_input) not between 1 and 120 then raise exception 'Invalid evidence'; end if;
 insert into public.complaint_documents(complaint_id,storage_path,file_name,mime_type,byte_size,uploaded_by) values(complaint_id_input,path_input,file_name_input,mime_input,size_input,auth.uid()) returning id into new_id;
 select election_id into election_key from public.complaints where id=complaint_id_input;
 insert into public.complaint_events(complaint_id,actor_id,event_type,public_note) values(complaint_id_input,auth.uid(),'evidence_added','Supporting evidence was attached to the complaint.');
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,election_id) values(auth.uid(),'complaint_evidence_added','complaint_document',new_id,election_key);
 return new_id;
end $$;
