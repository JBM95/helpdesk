-- Clears the pg-boss job backlog between E2E runs.
--
-- `prisma migrate reset` in global-setup.ts drops and recreates the `public`
-- schema, but pg-boss keeps its own `pgboss` schema (see CLAUDE.md § Job Queue),
-- which the reset never touches. Jobs from previous runs therefore survive into
-- the next one, where the ticket ids they carry no longer exist. Those jobs fail
-- and retry on a 30s backoff (retryLimit 3, retryBackoff true), and because a
-- freshly enqueued job queues behind the accumulated backlog, the ticket it was
-- enqueued for can still be at status "new" thirty seconds later.
--
-- Left alone the backlog grows monotonically with every local run, so the suite
-- gets less reliable the more you use it. Truncating makes each run independent.
--
-- Only `job` is cleared. `pgboss.queue` holds the queue registrations that a
-- reused worker still depends on (`reuseExistingServer` keeps the server alive
-- between local runs), so truncating that would break the workers instead.
-- Guarded on existence because the schema does not exist until pg-boss has
-- started at least once.
DO $$
BEGIN
  IF to_regclass('pgboss.job') IS NOT NULL THEN
    EXECUTE 'TRUNCATE pgboss.job';
  END IF;
END
$$;
