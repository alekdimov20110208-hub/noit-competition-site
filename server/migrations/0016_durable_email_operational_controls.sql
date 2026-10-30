-- Additive operational capabilities. No application table grant/policy is changed.
-- The migration owner owns these objects; runtime/browser roles never own them.
CREATE TABLE budograph_private.email_outbox (
  id TEXT PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  kind TEXT NOT NULL CHECK(kind IN ('invitation','verification','reset')),
  subject_key TEXT NOT NULL CHECK(subject_key ~ '^[a-f0-9]{64}$'),
  reference_hash TEXT NOT NULL CHECK(reference_hash ~ '^[a-f0-9]{64}$'),
  key_id TEXT NOT NULL CHECK(key_id ~ '^[a-z0-9_-]{1,32}$'),
  ciphertext TEXT CHECK(octet_length(ciphertext) BETWEEN 40 AND 24576),
  expires_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN
    ('pending','leased','retry','unknown','accepted','permanent','expired','obsolete','uncertain','blocked')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
  has_unknown BOOLEAN NOT NULL DEFAULT FALSE,
  lease_nonce UUID,
  lease_until TIMESTAMPTZ,
  first_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_outcome TEXT CHECK(last_outcome IN
    ('accepted','rejected','temporary','unknown','budget','invalid','expired','obsolete','exhausted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK((state='leased')=(lease_nonce IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX email_outbox_due ON budograph_private.email_outbox(next_attempt_at,id)
  WHERE state IN ('pending','retry','unknown','leased');
CREATE INDEX email_outbox_subject ON budograph_private.email_outbox(subject_key,created_at);
CREATE INDEX email_outbox_retention ON budograph_private.email_outbox(expires_at,id);
CREATE TABLE budograph_private.rate_counter (
  key_hash TEXT PRIMARY KEY CHECK(key_hash ~ '^[a-f0-9]{64}$'),
  count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 10000),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX rate_counter_expiry ON budograph_private.rate_counter(expires_at,key_hash);
ALTER TABLE budograph_private.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE budograph_private.rate_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON budograph_private.email_outbox,budograph_private.rate_counter FROM PUBLIC,budograph_runtime;

-- All-or-none consume, using database time, deterministic key order and bounded
-- storage. fixed=first accepted request; rolling=last accepted request (BA 1.7.7).
-- day/month are UTC calendar budgets. No identity/IP text is accepted or stored.
CREATE FUNCTION budograph_private.consume_limits(rules JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r JSONB; k TEXT; lim INTEGER; ms BIGINT; mode TEXT; n INTEGER;
  expiry TIMESTAMPTZ; stamp TIMESTAMPTZ; retry INTEGER:=0;
BEGIN
  IF jsonb_typeof(rules)<>'array' OR jsonb_array_length(rules) NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'Invalid limit rules.' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(rules))<>jsonb_array_length(rules) THEN
    RAISE EXCEPTION 'Duplicate limit key.' USING ERRCODE='22023';
  END IF;
  -- A short SQL-only admission lock protects the 10000-row cap, not HTTP work.
  PERFORM pg_advisory_xact_lock(43160,1);
  stamp:=clock_timestamp();
  FOR r IN SELECT value FROM jsonb_array_elements(rules) ORDER BY value->>'key' LOOP
    k:=r->>'key'; lim:=(r->>'max')::INTEGER; ms:=(r->>'windowMs')::BIGINT; mode:=r->>'mode';
    IF k IS NULL OR k !~ '^[a-f0-9]{64}$' OR lim IS NULL OR lim NOT BETWEEN 1 AND 10000
      OR ms IS NULL OR ms NOT BETWEEN 20 AND 2678400000 OR mode IS NULL
      OR mode NOT IN ('fixed','rolling','day','month') THEN
      RAISE EXCEPTION 'Invalid limit rule.' USING ERRCODE='22023';
    END IF;
    SELECT count,expires_at INTO n,expiry FROM budograph_private.rate_counter WHERE key_hash=k;
    IF expiry>stamp AND n>=lim THEN
      retry:=greatest(retry,ceil(extract(epoch FROM expiry-stamp))::INTEGER,1);
    END IF;
  END LOOP;
  IF retry>0 THEN RETURN jsonb_build_object('allowed',false,'retryAfter',retry); END IF;
  IF (SELECT count(*) FROM budograph_private.rate_counter)+
     (SELECT count(*) FROM jsonb_array_elements(rules) q WHERE NOT EXISTS
       (SELECT 1 FROM budograph_private.rate_counter c WHERE c.key_hash=q.value->>'key'))>10000 THEN
    -- Explicit bounded indexed cleanup, never an unbounded per-request scan.
    DELETE FROM budograph_private.rate_counter WHERE key_hash IN
      (SELECT key_hash FROM budograph_private.rate_counter WHERE expires_at<=stamp ORDER BY expires_at,key_hash LIMIT 32);
    IF (SELECT count(*) FROM budograph_private.rate_counter)+jsonb_array_length(rules)>10000 THEN
      RAISE EXCEPTION 'Operational capacity unavailable.' USING ERRCODE='53000';
    END IF;
  END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(rules) ORDER BY value->>'key' LOOP
    k:=r->>'key'; ms:=(r->>'windowMs')::BIGINT; mode:=r->>'mode';
    expiry:=CASE mode
      WHEN 'day' THEN (date_trunc('day',stamp AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC'
      WHEN 'month' THEN (date_trunc('month',stamp AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC'
      ELSE stamp+ms*interval '1 millisecond' END;
    INSERT INTO budograph_private.rate_counter AS c(key_hash,count,expires_at) VALUES(k,1,expiry)
    ON CONFLICT(key_hash) DO UPDATE SET
      count=CASE WHEN c.expires_at<=stamp THEN 1 ELSE c.count+1 END,
      expires_at=CASE WHEN c.expires_at<=stamp OR mode='rolling' THEN expiry ELSE c.expires_at END;
  END LOOP;
  RETURN jsonb_build_object('allowed',true,'retryAfter',0);
END $$;

CREATE FUNCTION budograph_private.enqueue_email(
  message_id TEXT,message_kind TEXT,subject TEXT,reference TEXT,expiry TIMESTAMPTZ,kid TEXT,payload TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF expiry IS NULL OR expiry<=clock_timestamp() OR expiry>clock_timestamp()+interval '8 days'
    OR payload IS NULL THEN RAISE EXCEPTION 'Invalid email expiry/payload.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(43160,2);
  IF EXISTS(SELECT 1 FROM budograph_private.email_outbox WHERE id=message_id) THEN RETURN message_id; END IF;
  IF (SELECT count(*) FROM budograph_private.email_outbox)>=1000 THEN
    RAISE EXCEPTION 'Operational capacity unavailable.' USING ERRCODE='53000';
  END IF;
  -- Insert validates metadata before superseding existing jobs. No raw tokens.
  INSERT INTO budograph_private.email_outbox(id,kind,subject_key,reference_hash,expires_at,key_id,ciphertext)
    VALUES(message_id,message_kind,subject,reference,expiry,kid,payload);
  UPDATE budograph_private.email_outbox SET state='obsolete',ciphertext=NULL,lease_nonce=NULL,lease_until=NULL,
    last_outcome='obsolete',updated_at=clock_timestamp()
    WHERE subject_key=subject AND id<>message_id AND state IN ('pending','retry','unknown','leased','blocked');
  RETURN message_id;
END $$;

-- Called on the owned client AFTER the C3 account gate and BEFORE any native
-- identity lookup. Both known and unknown recipients fail identically on a
-- full/unavailable outbox. Holding the same enqueue admission lock prevents a
-- capacity race during the native anti-enumeration timing floor.
CREATE FUNCTION budograph_private.reserve_email_capacity() RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(43160,2);
  IF NOT has_function_privilege(session_user,
    'budograph_private.enqueue_email(text,text,text,text,timestamp with time zone,text,text)','EXECUTE')
    OR (SELECT count(*) FROM budograph_private.email_outbox)>=1000 THEN
    RAISE EXCEPTION 'Operational capacity unavailable.' USING ERRCODE='53000';
  END IF;
  RETURN TRUE;
END $$;

CREATE FUNCTION budograph_private.claim_email(batch INTEGER,nonce UUID,target TEXT DEFAULT NULL)
RETURNS SETOF budograph_private.email_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE job budograph_private.email_outbox; stamp TIMESTAMPTZ:=clock_timestamp(); terminal TEXT; uncertain BOOLEAN;
BEGIN
  IF batch IS NULL OR batch NOT BETWEEN 1 AND 20 OR nonce IS NULL
    OR (target IS NOT NULL AND target !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'Invalid dispatch claim.' USING ERRCODE='22023'; END IF;
  FOR job IN SELECT * FROM budograph_private.email_outbox WHERE
    (target IS NULL OR id=target) AND next_attempt_at<=stamp AND
    (state IN ('pending','retry','unknown') OR (state='leased' AND lease_until<=stamp))
    ORDER BY next_attempt_at,id LIMIT batch FOR UPDATE SKIP LOCKED LOOP
    uncertain:=job.has_unknown OR (job.state='leased' AND coalesce(job.last_outcome='unknown',FALSE));
    terminal:=CASE WHEN job.expires_at<=stamp THEN 'expired'
      WHEN job.attempts>=8 OR job.first_attempt_at<=stamp-interval '23 hours'
        THEN CASE WHEN uncertain THEN 'uncertain' ELSE 'permanent' END END;
    IF terminal IS NOT NULL THEN
      UPDATE budograph_private.email_outbox SET state=terminal,has_unknown=uncertain,ciphertext=NULL,lease_nonce=NULL,lease_until=NULL,
        last_outcome=CASE WHEN terminal='expired' THEN 'expired' ELSE 'exhausted' END,updated_at=stamp WHERE id=job.id;
    ELSE
      RETURN QUERY UPDATE budograph_private.email_outbox SET state='leased',has_unknown=uncertain,lease_nonce=nonce,
        lease_until=stamp+interval '60 seconds',next_attempt_at=stamp+interval '60 seconds',updated_at=stamp
        WHERE id=job.id RETURNING *;
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION budograph_private.start_email(message_id TEXT,nonce UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  UPDATE budograph_private.email_outbox SET attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),
    last_outcome='unknown',updated_at=clock_timestamp()
    WHERE id=message_id AND state='leased' AND lease_nonce=nonce AND lease_until>clock_timestamp()
      AND expires_at>clock_timestamp() AND attempts<8
      AND (first_attempt_at IS NULL OR first_attempt_at>clock_timestamp()-interval '23 hours');
  RETURN FOUND;
END $$;

CREATE FUNCTION budograph_private.finish_email(message_id TEXT,nonce UUID,result TEXT,outcome TEXT,delay_seconds INTEGER)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE actual_state TEXT;
BEGIN
  IF result IS NULL OR result NOT IN ('accepted','permanent','expired','obsolete','retry','unknown','blocked')
    OR outcome IS NULL OR outcome NOT IN ('accepted','rejected','temporary','unknown','budget','invalid','expired','obsolete')
    OR delay_seconds IS NULL OR delay_seconds NOT BETWEEN 0 AND 86400 THEN
    RAISE EXCEPTION 'Invalid dispatch outcome.' USING ERRCODE='22023'; END IF;
  UPDATE budograph_private.email_outbox SET state=CASE WHEN result='permanent' AND has_unknown THEN 'uncertain' ELSE result END,
    has_unknown=has_unknown OR result='unknown',last_outcome=outcome,
    ciphertext=CASE WHEN result IN ('accepted','permanent','expired','obsolete') THEN NULL ELSE ciphertext END,
    lease_nonce=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+delay_seconds*interval '1 second',updated_at=clock_timestamp()
    WHERE id=message_id AND state='leased' AND lease_nonce=nonce AND lease_until>clock_timestamp()
    RETURNING state INTO actual_state;
  RETURN actual_state;
END $$;

-- Explicit operator/service recovery only; no public route. A key/config
-- problem retains authenticated ciphertext instead of destroying recovery data.
CREATE FUNCTION budograph_private.retry_blocked_email(message_id TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF message_id IS NULL OR message_id !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid email identity.' USING ERRCODE='22023'; END IF;
  UPDATE budograph_private.email_outbox SET state='pending',next_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=message_id AND state='blocked' AND ciphertext IS NOT NULL AND expires_at>clock_timestamp()
      AND attempts<8 AND (first_attempt_at IS NULL OR first_attempt_at>clock_timestamp()-interval '23 hours');
  RETURN FOUND;
END $$;

CREATE FUNCTION budograph_private.cleanup_operations(batch INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE counters INTEGER; jobs INTEGER; expired_jobs INTEGER; stamp TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF batch IS NULL OR batch NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid cleanup bound.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(43160,1);
  DELETE FROM budograph_private.rate_counter WHERE key_hash IN
    (SELECT key_hash FROM budograph_private.rate_counter WHERE expires_at<=stamp ORDER BY expires_at,key_hash LIMIT batch);
  GET DIAGNOSTICS counters=ROW_COUNT;
  -- Do not delete replay receipts until all original tokens and idempotency
  -- windows have expired; retain terminal metadata seven additional days.
  PERFORM pg_advisory_xact_lock(43160,2);
  UPDATE budograph_private.email_outbox SET state='expired',ciphertext=NULL,lease_nonce=NULL,lease_until=NULL,
    last_outcome='expired',updated_at=stamp WHERE id IN
    (SELECT id FROM budograph_private.email_outbox WHERE expires_at<=stamp
      AND state IN ('pending','retry','unknown','blocked') ORDER BY expires_at,id LIMIT batch FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS expired_jobs=ROW_COUNT;
  DELETE FROM budograph_private.email_outbox WHERE id IN
    (SELECT id FROM budograph_private.email_outbox WHERE expires_at<stamp-interval '7 days'
      AND state<>'leased' ORDER BY expires_at,id LIMIT batch);
  GET DIAGNOSTICS jobs=ROW_COUNT;
  RETURN jsonb_build_object('counters',counters,'jobs',jobs,'expired',expired_jobs);
END $$;

REVOKE ALL ON FUNCTION budograph_private.consume_limits(JSONB),
  budograph_private.reserve_email_capacity(),
  budograph_private.retry_blocked_email(TEXT),
  budograph_private.enqueue_email(TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT),
  budograph_private.claim_email(INTEGER,UUID,TEXT),budograph_private.start_email(TEXT,UUID),
  budograph_private.finish_email(TEXT,UUID,TEXT,TEXT,INTEGER),budograph_private.cleanup_operations(INTEGER)
FROM PUBLIC,budograph_runtime;
GRANT EXECUTE ON FUNCTION budograph_private.consume_limits(JSONB),
  budograph_private.reserve_email_capacity(),
  budograph_private.retry_blocked_email(TEXT),
  budograph_private.enqueue_email(TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT),
  budograph_private.claim_email(INTEGER,UUID,TEXT),budograph_private.start_email(TEXT,UUID),
  budograph_private.finish_email(TEXT,UUID,TEXT,TEXT,INTEGER),budograph_private.cleanup_operations(INTEGER)
TO budograph_runtime;
DO $$ DECLARE browser TEXT; BEGIN
  FOREACH browser IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=browser) THEN
      EXECUTE format('REVOKE ALL ON TABLE budograph_private.email_outbox,budograph_private.rate_counter FROM %I',browser);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA budograph_private FROM %I',browser);
    END IF;
  END LOOP;
END $$;
