-- In-app delivery only. Existing Tasks receive no default reminders.
CREATE TABLE public.task_reminder (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.task(id) ON DELETE RESTRICT,
  offset_minutes INTEGER NOT NULL CHECK (offset_minutes IN (1440, 60, 15)),
  due_at TIMESTAMPTZ NOT NULL CHECK (isfinite(due_at)),
  trigger_at TIMESTAMPTZ NOT NULL CHECK (isfinite(trigger_at)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, offset_minutes)
);
CREATE INDEX task_reminder_scan_idx ON public.task_reminder(trigger_at, due_at, task_id);
CREATE FUNCTION public.schedule_task_reminder() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE wall_time TIMESTAMP; zone TEXT;
BEGIN
  SELECT task.deadline + task.deadline_time, event.timezone INTO wall_time, zone
  FROM public.task JOIN public.event ON event.id = task.event_id WHERE task.id = NEW.task_id;
  IF wall_time IS NULL OR NOT public.is_valid_event_timezone(zone) THEN
    RAISE EXCEPTION 'Reminders require a timed deadline and valid Event timezone.' USING ERRCODE = '23514';
  END IF;
  NEW.due_at := wall_time AT TIME ZONE zone;
  NEW.trigger_at := NEW.due_at - make_interval(mins => NEW.offset_minutes);
  RETURN NEW;
END $$;
CREATE TRIGGER task_reminder_schedule BEFORE INSERT OR UPDATE ON public.task_reminder
FOR EACH ROW EXECUTE FUNCTION public.schedule_task_reminder();
CREATE FUNCTION public.reschedule_task_reminders() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.deadline_time IS NULL THEN
    DELETE FROM public.task_reminder WHERE task_id = NEW.id;
  ELSE
    UPDATE public.task_reminder SET offset_minutes = offset_minutes WHERE task_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task_reminder_deadline AFTER UPDATE OF deadline, deadline_time ON public.task
FOR EACH ROW WHEN (OLD.deadline IS DISTINCT FROM NEW.deadline OR OLD.deadline_time IS DISTINCT FROM NEW.deadline_time)
EXECUTE FUNCTION public.reschedule_task_reminders();
CREATE FUNCTION public.reschedule_event_reminders() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  UPDATE public.task_reminder SET offset_minutes = offset_minutes
  WHERE task_id IN (SELECT id FROM public.task WHERE event_id = NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER task_reminder_timezone AFTER UPDATE OF timezone ON public.event
FOR EACH ROW WHEN (OLD.timezone IS DISTINCT FROM NEW.timezone)
EXECUTE FUNCTION public.reschedule_event_reminders();

CREATE TABLE public.notification (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  recipient_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('TASK_ASSIGNED', 'TASK_DUE_REMINDER')),
  task_id UUID NOT NULL,
  actor_user_id TEXT REFERENCES public."user"(id) ON DELETE RESTRICT,
  task_title TEXT NOT NULL,
  deadline DATE NOT NULL,
  deadline_time TIME(0),
  timezone TEXT NOT NULL CHECK (public.is_valid_event_timezone(timezone)),
  reminder_offset_minutes INTEGER CHECK (reminder_offset_minutes IN (1440, 60, 15)),
  due_at TIMESTAMPTZ CHECK (isfinite(due_at)),
  task_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
  read_at TIMESTAMPTZ CHECK (isfinite(read_at)),
  FOREIGN KEY (event_id, task_id) REFERENCES public.task(event_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id, recipient_user_id) REFERENCES public.event_member(event_id, user_id) ON DELETE RESTRICT,
  CHECK ((kind = 'TASK_ASSIGNED' AND actor_user_id IS NOT NULL AND task_version IS NOT NULL
    AND task_version >= 1 AND reminder_offset_minutes IS NULL AND due_at IS NULL)
    OR (kind = 'TASK_DUE_REMINDER' AND actor_user_id IS NULL AND task_version IS NULL
    AND reminder_offset_minutes IS NOT NULL AND due_at IS NOT NULL AND deadline_time IS NOT NULL))
);
-- Typed deterministic schedule identity; independent of workers/restarts.
CREATE UNIQUE INDEX notification_reminder_dedupe ON public.notification(task_id, recipient_user_id, due_at, reminder_offset_minutes)
WHERE kind = 'TASK_DUE_REMINDER';
CREATE UNIQUE INDEX notification_assignment_dedupe ON public.notification(task_id, recipient_user_id, task_version)
WHERE kind = 'TASK_ASSIGNED';
CREATE INDEX notification_recent_idx ON public.notification(recipient_user_id, event_id, created_at DESC, id DESC);
CREATE INDEX notification_unread_idx ON public.notification(recipient_user_id, event_id) WHERE read_at IS NULL;
ALTER TABLE public.task_reminder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;
