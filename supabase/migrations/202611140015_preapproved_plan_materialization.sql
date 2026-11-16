-- A later, unrelated membership correction must not discard a still-valid
-- earlier election decision for the same person/email. This only materializes
-- preauthorized decisions in draft/prepared elections; open-window grant freeze
-- and the exact designated version remain enforced.
do $$ declare definition text; guarded text; begin
 select pg_get_functiondef('public.checked_bind_official_voter(text)'::regprocedure) into definition;
 guarded:=replace(definition,'where er.register_id=r.id on conflict(election_id,user_id)',
 'where exists(select 1 from public.official_register_entries planned_person where planned_person.register_id=er.register_id and planned_person.identity_id=entry.identity_id and planned_person.email=email_value) on conflict(election_id,user_id)');
 if guarded=definition then raise exception 'Missing preapproved plan boundary'; end if;
 execute guarded;
end $$;
