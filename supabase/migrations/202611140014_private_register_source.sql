create function public.get_register_source(register_input uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.official_registers%rowtype; calculated text;
begin
 if not public.has_committee_role(array['committee_chair']::public.committee_role[]) then raise exception 'Not authorized'; end if;
 select * into r from public.official_registers where id=register_input;
 if not found then raise exception 'Source unavailable'; end if;
 calculated:=encode(extensions.digest(r.rows_snapshot::text,'sha256'),'hex');
 if calculated<>r.snapshot_sha256 then raise exception 'Source integrity check failed'; end if;
 return jsonb_build_object('content',r.rows_snapshot::text,'sha256',calculated,'originalSourceSha256',r.source_sha256);
end $$;
revoke all on function public.get_register_source(uuid) from public,anon;
grant execute on function public.get_register_source(uuid) to authenticated;
