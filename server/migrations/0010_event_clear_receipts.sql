-- Add only Clear to the durable Event command boundary; 0001–0009 stay immutable.
ALTER TABLE public.event_command_receipt
  DROP CONSTRAINT event_command_receipt_command_type_check,
  ADD CONSTRAINT event_command_receipt_command_type_check
    CHECK (command_type IN ('EVENT_DUPLICATE', 'EVENT_ARCHIVE', 'EVENT_TASKS_CLEAR')),
  ADD CONSTRAINT event_clear_receipt_scope_check CHECK (
    command_type <> 'EVENT_TASKS_CLEAR' OR (
      result_event_id = source_event_id
      AND outcome ?& ARRAY['event','clearedCount','operationId']
      AND outcome -> 'event' ->> 'id' = source_event_id::TEXT
      AND outcome -> 'event' -> 'archived' = 'false'::JSONB
      AND jsonb_typeof(outcome -> 'clearedCount') = 'number'
      AND (outcome ->> 'clearedCount')::NUMERIC >= 0
      AND outcome ->> 'operationId' = command_id::TEXT
    )
  );
