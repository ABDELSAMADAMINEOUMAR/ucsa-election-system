-- Per-schema REVOKE cannot remove PostgreSQL's global default PUBLIC EXECUTE.
-- Future functions owned by the migration role require explicit client grants.
alter default privileges for role postgres revoke execute on functions from public,anon,authenticated;
