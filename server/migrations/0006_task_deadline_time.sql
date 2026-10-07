-- Optional Event-local wall-clock deadline; existing DATE values are unchanged.
-- No default/backfill: existing tasks retain date-only deadlines.
ALTER TABLE public.task
  ADD COLUMN deadline_time TIME(0) WITHOUT TIME ZONE NULL,
  ADD CONSTRAINT task_deadline_time_minute CHECK (
    deadline_time IS NULL OR
    (deadline_time < TIME '24:00' AND EXTRACT(SECOND FROM deadline_time) = 0)
  );
