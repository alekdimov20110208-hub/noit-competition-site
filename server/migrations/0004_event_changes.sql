-- P3A: current-state Change records and explicit same-Event Task links.
-- Response ownership is operational, never an access role or Task acceptance.
CREATE TABLE public.event_change (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  title TEXT NOT NULL CHECK (title ~ '[^[:space:]]' AND char_length(title) <= 200),
  context TEXT NOT NULL DEFAULT '' CHECK (char_length(context) <= 5000),
  created_by UUID NOT NULL,
  response_owner_member_id UUID,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(updated_at)),
  CONSTRAINT event_change_scope_unique UNIQUE (event_id, id),
  CONSTRAINT event_change_creator_scope FOREIGN KEY (event_id, created_by)
    REFERENCES public.event_member (event_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT event_change_owner_scope FOREIGN KEY (event_id, response_owner_member_id)
    REFERENCES public.event_member (event_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE public.change_task (
  event_id UUID NOT NULL,
  change_id UUID NOT NULL,
  task_id UUID NOT NULL,
  PRIMARY KEY (event_id, change_id, task_id),
  CONSTRAINT change_task_change_scope FOREIGN KEY (event_id, change_id)
    REFERENCES public.event_change (event_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT change_task_task_scope FOREIGN KEY (event_id, task_id)
    REFERENCES public.task (event_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX event_change_event_time_idx ON public.event_change (event_id, created_at DESC, id);
CREATE INDEX change_task_task_idx ON public.change_task (event_id, task_id, change_id);

-- Same deny-direct-Data-API convention as the existing application tables.
-- Fastify's session/membership checks remain the security boundary.
ALTER TABLE public.event_change ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_task ENABLE ROW LEVEL SECURITY;
