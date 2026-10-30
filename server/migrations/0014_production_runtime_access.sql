-- CANDIDATE ONLY: OWNER APPROVAL + NEW REVIEWED BASELINE REQUIRED.
-- PRODUCTION MUTATIONS NOT AUTHORIZED. Never mix with the accepted 0014 checksum.
-- Requires the runner's existing per-file BEGIN; no role or ACL change.
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN
  IF CURRENT_USER<>'budograph_migrator' OR SESSION_USER<>'postgres'
    OR pg_catalog.current_database()<>'postgres' THEN
    RAISE EXCEPTION 'Isolated creator/session identity required.';
  END IF;
  IF NOT pg_catalog.pg_has_role('postgres','budograph_migrator','USAGE')
    OR pg_catalog.pg_has_role('budograph_migrator','postgres','MEMBER') THEN
    RAISE EXCEPTION 'Automatic RLS owner authority or membership direction invalid.';
  END IF;
END $$;

-- Trusted backend capabilities only. Browser identities never receive policies.
-- Provision the fixed runtime LOGIN separately, without secrets in migration SQL.
DO $$
DECLARE runtime_oid OID;
BEGIN
  SELECT oid INTO runtime_oid FROM pg_catalog.pg_roles
  WHERE rolname='budograph_runtime' AND rolcanlogin AND NOT rolsuper
    AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication;
  IF runtime_oid IS NULL OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=runtime_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class WHERE relowner=runtime_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner=runtime_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc WHERE proowner=runtime_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_database WHERE datdba=runtime_oid
  ) THEN
    RAISE EXCEPTION 'A separately provisioned non-owner runtime role is required.';
  END IF;
END $$;

-- Shared database/public ACLs are owned by the provider/owner, not this creator.
-- Bootstrap supplies USAGE; inspect effective denials without revoking PUBLIC.
-- OWNER APPROVAL REQUIRED: inherited PUBLIC TEMP is preserved, not denied.
DO $$
DECLARE public_temp BOOLEAN; runtime_oid OID;
BEGIN
  SELECT oid INTO STRICT runtime_oid FROM pg_catalog.pg_roles WHERE rolname='budograph_runtime';
  IF pg_catalog.has_database_privilege('budograph_runtime',pg_catalog.current_database(),'CREATE')
    OR pg_catalog.has_schema_privilege('budograph_runtime','public','CREATE')
    OR NOT pg_catalog.has_schema_privilege('budograph_runtime','public','USAGE') THEN
    RAISE EXCEPTION 'Unexpected runtime permanent-DDL or schema usage privileges.';
  END IF;
  SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(d.datacl,
    pg_catalog.acldefault('d',d.datdba))) AS a
    WHERE a.grantee=0 AND a.privilege_type='TEMPORARY') INTO public_temp
  FROM pg_catalog.pg_database AS d WHERE d.datname=pg_catalog.current_database();
  IF pg_catalog.has_database_privilege('budograph_runtime',pg_catalog.current_database(),'TEMPORARY')
      IS DISTINCT FROM public_temp OR EXISTS(
    SELECT 1 FROM pg_catalog.pg_database AS d,
      LATERAL pg_catalog.aclexplode(COALESCE(d.datacl,pg_catalog.acldefault('d',d.datdba))) AS a
    WHERE d.datname=pg_catalog.current_database() AND a.grantee=runtime_oid
      AND a.privilege_type='TEMPORARY') THEN
    RAISE EXCEPTION 'Runtime TEMP must derive only from the unchanged PUBLIC baseline.';
  END IF;
END $$;

DO $$
DECLARE relation TEXT; browser TEXT; columns TEXT;
  all_relations TEXT[] := ARRAY['user','session','account','verification','event','event_member','task',
    'activity_entry','event_invitation','event_change','change_task','task_reminder','notification',
    'event_command_receipt','template_application_receipt','personal_template','personal_template_version',
    'personal_template_item','personal_template_save_receipt','schema_migrations'];
BEGIN
  FOREACH relation IN ARRAY all_relations LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid=format('public.%I',relation)::regclass) THEN
      RAISE EXCEPTION 'Unexpected pre-existing application policy; manual review is required.';
    END IF;
    SELECT string_agg(quote_ident(attname),', ' ORDER BY attnum) INTO columns
    FROM pg_catalog.pg_attribute
    WHERE attrelid=format('public.%I',relation)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,budograph_runtime',relation);
    -- Table-level REVOKE does not remove existing column ACLs.
    EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM PUBLIC,budograph_runtime',columns,relation);
    FOREACH browser IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=browser) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',relation,browser);
        EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM %I',columns,relation,browser);
      END IF;
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('CREATE POLICY budograph_runtime_select ON public.%I FOR SELECT TO budograph_runtime USING (true)',relation);
    IF relation <> 'schema_migrations' THEN
      EXECUTE format('CREATE POLICY budograph_runtime_insert ON public.%I FOR INSERT TO budograph_runtime WITH CHECK (true)',relation);
    END IF;
  END LOOP;
  FOREACH relation IN ARRAY ARRAY['user','session','account','event','event_member','task','event_invitation','event_change','task_reminder','notification'] LOOP
    -- SELECT FOR SHARE/UPDATE needs both UPDATE privilege and UPDATE USING.
    -- Membership has a lock-only capability: every actual UPDATE fails its check.
    EXECUTE format('CREATE POLICY budograph_runtime_update ON public.%I FOR UPDATE TO budograph_runtime USING (true) WITH CHECK (%s)',
      relation,CASE WHEN relation='event_member' THEN 'false' ELSE 'true' END);
  END LOOP;
  FOREACH relation IN ARRAY ARRAY['session','verification','change_task','task_reminder'] LOOP
    EXECUTE format('CREATE POLICY budograph_runtime_delete ON public.%I FOR DELETE TO budograph_runtime USING (true)',relation);
  END LOOP;
END $$;

GRANT SELECT ON public."user",public.session,public.account,public.verification,
  public.event,public.event_member,public.task,public.activity_entry,public.event_invitation,
  public.event_change,public.change_task,public.task_reminder,public.notification,
  public.event_command_receipt,public.template_application_receipt,public.personal_template,
  public.personal_template_version,public.personal_template_item,public.personal_template_save_receipt
TO budograph_runtime;
GRANT SELECT(version,name,checksum) ON public.schema_migrations TO budograph_runtime;

GRANT INSERT(id,name,email,"emailVerified",image,"createdAt","updatedAt",active) ON public."user" TO budograph_runtime;
GRANT UPDATE(name,"emailVerified","updatedAt") ON public."user" TO budograph_runtime;
GRANT INSERT(id,"expiresAt",token,"createdAt","updatedAt","ipAddress","userAgent","userId") ON public.session TO budograph_runtime;
GRANT UPDATE("expiresAt","updatedAt") ON public.session TO budograph_runtime;
GRANT DELETE ON public.session TO budograph_runtime;
GRANT INSERT(id,"accountId","providerId","userId",password,"createdAt","updatedAt") ON public.account TO budograph_runtime;
GRANT UPDATE(password,"updatedAt") ON public.account TO budograph_runtime;
GRANT INSERT(id,identifier,value,"expiresAt","createdAt","updatedAt") ON public.verification TO budograph_runtime;
GRANT DELETE ON public.verification TO budograph_runtime;

GRANT INSERT(id,name,start_date,end_date,timezone,owner_user_id) ON public.event TO budograph_runtime;
GRANT UPDATE(name,start_date,end_date,timezone,archived_at,version,updated_at) ON public.event TO budograph_runtime;
GRANT INSERT(id,event_id,user_id,access_role,operational_role,active) ON public.event_member TO budograph_runtime;
GRANT UPDATE(version) ON public.event_member TO budograph_runtime;
GRANT INSERT(id,event_id,title,category,context,deadline,priority,assigned_member_id,created_by,updated_by,deadline_time) ON public.task TO budograph_runtime;
GRANT UPDATE(title,category,context,deadline,deadline_time,priority,assigned_member_id,accepted_by_member_id,
  accepted_at,status,version,updated_by,updated_at,deleted_at,deleted_by) ON public.task TO budograph_runtime;
GRANT INSERT(id,event_id,invited_email,inviter_user_id,token_hash,expires_at) ON public.event_invitation TO budograph_runtime;
GRANT UPDATE(token_hash,accepted_at,accepted_user_id,revoked_at) ON public.event_invitation TO budograph_runtime;
GRANT INSERT(id,event_id,title,context,created_by,response_owner_member_id,decision_text,response_text,plan_b_text,
  decision_author_member_id,decision_created_at,decision_updated_at) ON public.event_change TO budograph_runtime;
GRANT UPDATE(title,context,response_owner_member_id,decision_text,response_text,plan_b_text,decision_author_member_id,
  decision_created_at,decision_updated_at,version,updated_at) ON public.event_change TO budograph_runtime;
GRANT INSERT,DELETE ON public.change_task TO budograph_runtime;
GRANT INSERT(id,task_id,offset_minutes,due_at,trigger_at) ON public.task_reminder TO budograph_runtime;
GRANT UPDATE(offset_minutes) ON public.task_reminder TO budograph_runtime;
GRANT DELETE ON public.task_reminder TO budograph_runtime;
GRANT INSERT(id,event_id,recipient_user_id,kind,task_id,actor_user_id,task_title,deadline,deadline_time,timezone,
  reminder_offset_minutes,due_at,task_version,created_at) ON public.notification TO budograph_runtime;
GRANT UPDATE(read_at) ON public.notification TO budograph_runtime;
GRANT INSERT ON public.activity_entry,public.event_command_receipt,public.template_application_receipt,
  public.personal_template,public.personal_template_version,public.personal_template_item,public.personal_template_save_receipt
TO budograph_runtime;

-- Trigger functions retain their invoker semantics and all existing guards.
-- Only the timezone predicate is called directly by runtime SQL/CHECKs.
REVOKE ALL ON FUNCTION public.is_valid_event_timezone(TEXT),public.reject_activity_entry_mutation(),
  public.schedule_task_reminder(),public.reschedule_task_reminders(),public.reschedule_event_reminders(),
  public.reject_event_command_receipt_mutation() FROM PUBLIC,budograph_runtime;
GRANT EXECUTE ON FUNCTION public.is_valid_event_timezone(TEXT) TO budograph_runtime;
DO $$ DECLARE browser TEXT; BEGIN
  FOREACH browser IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=browser) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.is_valid_event_timezone(TEXT),public.reject_activity_entry_mutation(),public.schedule_task_reminder(),public.reschedule_task_reminders(),public.reschedule_event_reminders(),public.reject_event_command_receipt_mutation() FROM %I',browser);
    END IF;
  END LOOP;
END $$;

-- Defaults affect only objects subsequently created by this migration identity.
-- New tables still require an explicit reviewed runtime grant/policy migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
-- The built-in PUBLIC EXECUTE default is global; a schema-local REVOKE
-- cannot subtract it. Scope this global default change to the migration owner.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
DO $$ DECLARE target TEXT; BEGIN
  FOREACH target IN ARRAY ARRAY['budograph_runtime','anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=target) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM %I',target);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',target);
      EXECUTE format('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM %I',target);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',target);
    END IF;
  END LOOP;
END $$;

-- This creator creates no sequences in 0001-0016; keep future defaults owner-only.
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC,budograph_runtime,anon,authenticated,service_role;
