-- Only committed curated-template application results. No custom templates.
CREATE TABLE public.template_application_receipt (
  actor_user_id TEXT NOT NULL REFERENCES public."user" (id) ON DELETE RESTRICT,
  operation_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE RESTRICT,
  template_id TEXT NOT NULL CHECK (template_id = 'international-aikido-seminar'),
  template_version INTEGER NOT NULL CHECK (template_version = 1),
  request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  outcome JSONB NOT NULL CHECK (
    jsonb_typeof(outcome) = 'object'
    AND outcome ?& ARRAY['eventId','operationId','templateId','templateVersion','createdCount','taskIds','itemIds','language']
    AND outcome ->> 'eventId' = event_id::TEXT
    AND outcome ->> 'operationId' = operation_id::TEXT
    AND outcome ->> 'templateId' = template_id
    AND (outcome ->> 'templateVersion')::INTEGER = template_version
    AND jsonb_typeof(outcome -> 'taskIds') = 'array'
    AND jsonb_typeof(outcome -> 'itemIds') = 'array'
    AND jsonb_typeof(outcome -> 'createdCount') = 'number'
    AND (outcome ->> 'createdCount')::INTEGER BETWEEN 1 AND 4
    AND jsonb_array_length(outcome -> 'taskIds') = (outcome ->> 'createdCount')::INTEGER
    AND jsonb_array_length(outcome -> 'itemIds') = (outcome ->> 'createdCount')::INTEGER
    AND outcome ->> 'language' IN ('bg','en')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_user_id, operation_id)
);

CREATE TRIGGER template_application_receipt_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.template_application_receipt
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_event_command_receipt_mutation();

ALTER TABLE public.template_application_receipt ENABLE ROW LEVEL SECURITY;
