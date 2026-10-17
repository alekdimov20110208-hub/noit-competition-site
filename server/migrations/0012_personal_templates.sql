-- Private, immutable blueprints. Backend session authorization is mandatory;
-- no browser/Supabase anon or authenticated role receives table access.
CREATE TABLE public.personal_template (
  id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX personal_template_owner_idx ON public.personal_template(owner_user_id,id);

CREATE TABLE public.personal_template_version (
  template_id UUID NOT NULL REFERENCES public.personal_template(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 2147483647),
  name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(template_id,version)
);
CREATE TABLE public.personal_template_item (
  template_id UUID NOT NULL,
  template_version INTEGER NOT NULL,
  item_id UUID NOT NULL,
  position SMALLINT NOT NULL CHECK(position BETWEEN 0 AND 49),
  title TEXT NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
  category TEXT NOT NULL CHECK(length(category)<=100),
  context TEXT NOT NULL DEFAULT '' CHECK(length(context)<=5000),
  priority TEXT NOT NULL CHECK(priority IN ('normal','important','critical')),
  day_offset INTEGER NOT NULL CHECK(day_offset BETWEEN -3660 AND 3660),
  deadline_time TIME(0) CHECK(deadline_time IS NULL OR (deadline_time < TIME '24:00' AND EXTRACT(SECOND FROM deadline_time)=0)),
  PRIMARY KEY(template_id,template_version,item_id),
  UNIQUE(template_id,template_version,position),
  FOREIGN KEY(template_id,template_version) REFERENCES public.personal_template_version(template_id,version) ON DELETE RESTRICT
);
CREATE TABLE public.personal_template_save_receipt (
  actor_user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  operation_id UUID NOT NULL,
  source_event_id UUID NOT NULL REFERENCES public.event(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES public.personal_template(id) ON DELETE RESTRICT,
  request_digest TEXT NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,operation_id)
);

CREATE TRIGGER personal_template_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.personal_template
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_event_command_receipt_mutation();
CREATE TRIGGER personal_template_version_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.personal_template_version
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_event_command_receipt_mutation();
CREATE TRIGGER personal_template_item_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.personal_template_item
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_event_command_receipt_mutation();
CREATE TRIGGER personal_template_save_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.personal_template_save_receipt
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_event_command_receipt_mutation();
ALTER TABLE public.personal_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_template_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_template_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_template_save_receipt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_template,public.personal_template_version,public.personal_template_item,public.personal_template_save_receipt FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON public.personal_template,public.personal_template_version,public.personal_template_item,public.personal_template_save_receipt FROM anon;
  END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON public.personal_template,public.personal_template_version,public.personal_template_item,public.personal_template_save_receipt FROM authenticated;
  END IF;
END $$;

-- Extend the accepted receipt, never replace the T2 transaction or its rows.
ALTER TABLE public.template_application_receipt DROP CONSTRAINT template_application_receipt_template_id_check;
ALTER TABLE public.template_application_receipt DROP CONSTRAINT template_application_receipt_template_version_check;
ALTER TABLE public.template_application_receipt DROP CONSTRAINT template_application_receipt_check;
ALTER TABLE public.template_application_receipt ADD CONSTRAINT template_application_receipt_identity_check CHECK (
 (template_id='international-aikido-seminar' AND template_version=1) OR
 (template_id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' AND template_version BETWEEN 1 AND 2147483647)
);
ALTER TABLE public.template_application_receipt ADD CONSTRAINT template_application_receipt_outcome_check CHECK (
 jsonb_typeof(outcome)='object'
 AND outcome ?& ARRAY['eventId','operationId','templateId','templateVersion','createdCount','taskIds','itemIds','language']
 AND outcome->>'eventId'=event_id::TEXT AND outcome->>'operationId'=operation_id::TEXT
 AND outcome->>'templateId'=template_id AND (outcome->>'templateVersion')::INTEGER=template_version
 AND jsonb_typeof(outcome->'taskIds')='array' AND jsonb_typeof(outcome->'itemIds')='array'
 AND jsonb_typeof(outcome->'createdCount')='number'
 AND (outcome->>'createdCount')::INTEGER BETWEEN 1 AND CASE WHEN template_id='international-aikido-seminar' THEN 4 ELSE 50 END
 AND jsonb_array_length(outcome->'taskIds')=(outcome->>'createdCount')::INTEGER
 AND jsonb_array_length(outcome->'itemIds')=(outcome->>'createdCount')::INTEGER
 AND outcome->>'language' IN ('bg','en')
);
