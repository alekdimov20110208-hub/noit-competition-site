-- P3B: one current Decision and optional coordination/fallback text in Change.
-- Existing P3A rows receive empty state; no links, owners or Tasks are changed.
ALTER TABLE public.event_change
  ADD COLUMN decision_text TEXT,
  ADD COLUMN decision_author_member_id UUID,
  ADD COLUMN decision_created_at TIMESTAMPTZ,
  ADD COLUMN decision_updated_at TIMESTAMPTZ,
  ADD COLUMN response_text TEXT,
  ADD COLUMN plan_b_text TEXT,
  ADD CONSTRAINT event_change_decision_text CHECK (
    decision_text IS NULL OR (decision_text ~ '[^[:space:]]' AND char_length(decision_text) <= 2000)
  ),
  ADD CONSTRAINT event_change_response_text CHECK (
    response_text IS NULL OR (response_text ~ '[^[:space:]]' AND char_length(response_text) <= 5000)
  ),
  ADD CONSTRAINT event_change_plan_b_text CHECK (
    plan_b_text IS NULL OR (plan_b_text ~ '[^[:space:]]' AND char_length(plan_b_text) <= 5000)
  ),
  ADD CONSTRAINT event_change_decision_complete CHECK (
    (decision_text IS NULL AND decision_author_member_id IS NULL AND decision_created_at IS NULL AND decision_updated_at IS NULL)
    OR
    (decision_text IS NOT NULL AND decision_author_member_id IS NOT NULL
      AND decision_created_at IS NOT NULL AND decision_updated_at IS NOT NULL
      AND isfinite(decision_created_at) AND isfinite(decision_updated_at)
      AND decision_updated_at >= decision_created_at)
  ),
  ADD CONSTRAINT event_change_decision_author_scope FOREIGN KEY (event_id, decision_author_member_id)
    REFERENCES public.event_member (event_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
