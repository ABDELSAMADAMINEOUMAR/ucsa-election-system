-- Draft edits never grant direct table UPDATE or permit roster/decision changes.
create function public.update_candidate_draft(application_id_input uuid, biography_input text, manifesto_input text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.candidate_applications%rowtype; e public.elections%rowtype;
begin
 if not public.is_active_session() then raise exception 'Not authorized'; end if;
 select * into a from public.candidate_applications where id=application_id_input and user_id=auth.uid() for update;
 if not found or a.status<>'draft' then raise exception 'Draft application unavailable'; end if;
 select * into e from public.elections where id=a.election_id for update;
 if e.status not in('draft','prepared') or clock_timestamp()<e.nominations_start or clock_timestamp()>e.nominations_end
  or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.verification_status='verified')
  or not exists(select 1 from public.election_eligibility x where x.user_id=auth.uid() and x.election_id=a.election_id and x.status='verified')
 then raise exception 'Nomination access unavailable'; end if;
 if biography_input is null or manifesto_input is null or char_length(trim(biography_input)) not between 30 and 1000
  or char_length(trim(manifesto_input)) not between 80 and 5000 then raise exception 'Invalid application content'; end if;
 update public.candidate_applications set biography=trim(biography_input),manifesto=trim(manifesto_input) where id=a.id;
end $$;
revoke all on function public.update_candidate_draft(uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_candidate_draft(uuid,text,text) to authenticated;
