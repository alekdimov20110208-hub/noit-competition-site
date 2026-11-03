-- Not a migration. Never add to server/migrations or Supabase migration metadata.
-- Wrapper holds the same verified owner connection and a transaction.
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN
  IF session_user <> 'postgres' OR current_user <> 'budograph_migrator'
    OR current_database() <> 'postgres'
    OR current_setting('budograph.verified_project_ref',true) IS DISTINCT FROM 'jlladwdqdillryyfvndo'
    OR current_setting('budograph.staging_database_id',true) IS DISTINCT FROM 'bce50118-4829-42e0-86cd-1cb41de8b1ba'
    OR (SELECT count(*) FROM public.schema_migrations) <> 16 THEN
    RAISE EXCEPTION 'Verified staging target and original history required';
  END IF;
END $$;
LOCK TABLE budograph_private.environment_identity IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM budograph_private.environment_identity)
    OR (SELECT count(*) FROM pg_constraint WHERE conrelid='budograph_private.environment_identity'::regclass AND contype='c') <> 3
    OR NOT EXISTS(SELECT 1 FROM pg_constraint
      WHERE conrelid='budograph_private.environment_identity'::regclass
      AND conname='environment_identity_environment_check' AND convalidated
      AND pg_get_constraintdef(oid) = 'CHECK ((environment = ''production''::text))') THEN
    RAISE EXCEPTION 'Expected empty immutable 0015 identity catalog';
  END IF;
END $$;
ALTER TABLE budograph_private.environment_identity DROP CONSTRAINT environment_identity_environment_check;
ALTER TABLE budograph_private.environment_identity ADD CONSTRAINT environment_identity_environment_check CHECK(environment='staging');
INSERT INTO budograph_private.environment_identity(singleton,database_id,environment,project_ref)
VALUES(true,'bce50118-4829-42e0-86cd-1cb41de8b1ba','staging','jlladwdqdillryyfvndo');
