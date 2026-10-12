-- Stage 4: committed results only. Business effects, audit and receipt share one
-- transaction; a failed command leaves no pending receipt to repair or expire.
CREATE TABLE public.event_command_receipt (
  actor_user_id TEXT NOT NULL REFERENCES public."user" (id) ON DELETE RESTRICT,
  command_id UUID NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type = 'EVENT_DUPLICATE'),
  source_event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE RESTRICT,
  result_event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE RESTRICT,
  request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  outcome JSONB NOT NULL CHECK (
    jsonb_typeof(outcome) = 'object' AND outcome ? 'id'
    AND outcome ->> 'id' = result_event_id::TEXT
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_user_id, command_id)
);

CREATE FUNCTION public.reject_event_command_receipt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Event command receipts are immutable.' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER event_command_receipt_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.event_command_receipt
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_event_command_receipt_mutation();

-- Backend-only receipts. Neither raw commands nor credentials are persisted.
ALTER TABLE public.event_command_receipt ENABLE ROW LEVEL SECURITY;
