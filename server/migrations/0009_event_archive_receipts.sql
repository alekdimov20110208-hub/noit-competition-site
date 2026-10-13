-- Add Archive to the established durable boundary. Applied 0008 stays immutable.
ALTER TABLE public.event_command_receipt
  DROP CONSTRAINT event_command_receipt_command_type_check,
  ADD CONSTRAINT event_command_receipt_command_type_check
    CHECK (command_type IN ('EVENT_DUPLICATE', 'EVENT_ARCHIVE')),
  ADD CONSTRAINT event_archive_receipt_scope_check CHECK (
    command_type <> 'EVENT_ARCHIVE' OR
    (result_event_id = source_event_id AND outcome -> 'archived' = 'true'::JSONB)
  );
