-- A reinstatement instruction is evidence for ONE approval, not an instruction
-- that may be inherited and replayed by an unrelated later correction.
create function public.clear_register_intents(rows_input jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_agg(value-'identityStatus' order by ordinality) from jsonb_array_elements(rows_input) with ordinality;
$$;
revoke all on function public.clear_register_intents(jsonb) from public,anon,authenticated;
do $$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('propose_register_correction','propose_membership_change') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'jsonb_array_elements(r.rows_snapshot)','jsonb_array_elements(public.clear_register_intents(r.rows_snapshot))');
  definition:=replace(definition,'rows_value:=r.rows_snapshot||','rows_value:=public.clear_register_intents(r.rows_snapshot)||');
  execute definition;
 end loop;
end $$;
