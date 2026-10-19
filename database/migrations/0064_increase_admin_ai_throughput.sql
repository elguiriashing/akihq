begin;

-- Administrative catalogue imports can legitimately resolve hundreds of
-- venues in one operator-authorized run. The existing monthly hard cap still
-- bounds spend; these settings only remove the six-request burst bottleneck.
update public.ai_budget_settings
set requests_per_minute = 120,
    requests_per_hour = 5000,
    max_concurrent_requests = 10,
    updated_at = now()
where singleton;

commit;
