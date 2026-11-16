-- Evidence is served only through the server authorization RPC and short-lived
-- signed URLs. No authenticated client receives direct object-list/read policy.
drop policy if exists complaint_evidence_read_related on storage.objects;
