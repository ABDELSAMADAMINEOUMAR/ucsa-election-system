-- An unrelated source-version correction must not invalidate a previously
-- proved email for the SAME permanently bound person. The current locked
-- version and current confirmed Auth email still have to match exactly.
do $$ declare definition text; begin
 select pg_get_functiondef('public.has_student_access()'::regprocedure) into definition;
 definition:=replace(definition,'and proof.register_id=r.id','');
 execute definition;
end $$;
