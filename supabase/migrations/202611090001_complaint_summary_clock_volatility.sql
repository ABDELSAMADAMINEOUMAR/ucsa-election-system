-- This report checks clock_timestamp(). A STABLE declaration incorrectly
-- promises statement-wide stability for a clock-dependent authorization gate.
-- Change only planner metadata; preserve the function body, grants and RLS.
alter function public.get_election_complaint_summary(uuid) volatile;
