-- No environment-specific row is seeded. Owner supplies non-secret deployment
-- identity only after independently verifying an isolated production target.
CREATE SCHEMA budograph_private;
REVOKE ALL ON SCHEMA budograph_private FROM PUBLIC;
GRANT USAGE ON SCHEMA budograph_private TO budograph_runtime;
CREATE TABLE budograph_private.environment_identity (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
  database_id UUID NOT NULL UNIQUE,
  environment TEXT NOT NULL CHECK(environment='production'),
  project_ref TEXT NOT NULL CHECK(project_ref ~ '^[a-z0-9][a-z0-9_-]{2,63}$')
);
REVOKE ALL ON TABLE budograph_private.environment_identity FROM PUBLIC,budograph_runtime;
GRANT SELECT ON budograph_private.environment_identity TO budograph_runtime;
ALTER TABLE budograph_private.environment_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY budograph_runtime_select ON budograph_private.environment_identity
  FOR SELECT TO budograph_runtime USING(true);
DO $$ DECLARE browser TEXT; BEGIN
  FOREACH browser IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=browser) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA budograph_private FROM %I',browser);
      EXECUTE format('REVOKE ALL ON TABLE budograph_private.environment_identity FROM %I',browser);
    END IF;
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA budograph_private REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA budograph_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
