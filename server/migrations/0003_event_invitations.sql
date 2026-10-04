-- P2C: one-use Event invitations. Only SHA-256 digests are persisted.
CREATE TABLE public.event_invitation (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  invited_email TEXT NOT NULL CHECK (length(invited_email) BETWEEN 3 AND 254 AND invited_email = lower(btrim(invited_email))),
  inviter_user_id TEXT NOT NULL REFERENCES public."user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
  expires_at TIMESTAMPTZ NOT NULL CHECK (isfinite(expires_at)),
  accepted_at TIMESTAMPTZ CHECK (isfinite(accepted_at)),
  accepted_user_id TEXT REFERENCES public."user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  revoked_at TIMESTAMPTZ CHECK (isfinite(revoked_at)),
  CONSTRAINT invitation_expiration_order CHECK (expires_at > created_at),
  CONSTRAINT invitation_acceptance_pair CHECK ((accepted_at IS NULL) = (accepted_user_id IS NULL)),
  CONSTRAINT invitation_terminal_state CHECK (accepted_at IS NULL OR revoked_at IS NULL),
  CONSTRAINT invitation_accepted_member FOREIGN KEY (event_id, accepted_user_id)
    REFERENCES public.event_member (event_id, user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX invitation_event_email_pending_idx ON public.event_invitation (event_id, invited_email, expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
-- Expiration is time-dependent; Event row locks serialize duplicate checks/writes.
ALTER TABLE public.event_invitation ENABLE ROW LEVEL SECURITY;
