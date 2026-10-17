-- Additive extension of receipt validation only. No catalog rows, backfill,
-- business-row changes, RLS changes or changes to the immutable trigger.
-- Source-controlled runtime catalog lookup remains the identity/content authority.
ALTER TABLE public.template_application_receipt
  DROP CONSTRAINT template_application_receipt_identity_check;
ALTER TABLE public.template_application_receipt
  ADD CONSTRAINT template_application_receipt_identity_check CHECK (
    (template_id = 'international-aikido-seminar' AND template_version = 1)
    OR (length(template_id) BETWEEN 10 AND 100
        AND template_id ~ '^curated-[a-z][a-z0-9]*(-[a-z0-9]+)*$'
        AND template_version = 1)
    OR (template_id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
        AND template_version BETWEEN 1 AND 2147483647)
  );
-- 0012 already bounds non-starter outcomes to 1..50 items, checks matching
-- identities/counts and retains the original starter's 1..4 bound.
