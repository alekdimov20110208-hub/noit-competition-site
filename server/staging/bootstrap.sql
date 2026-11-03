-- D2.3 only. Called after read-only target/catalog verification, in a transaction.
DO $$ BEGIN
  IF session_user <> 'postgres' OR current_user <> 'postgres'
    OR current_database() <> 'postgres'
    OR current_setting('budograph.verified_project_ref',true) IS DISTINCT FROM 'jlladwdqdillryyfvndo'
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('budograph_migrator','budograph_runtime')) THEN
    RAISE EXCEPTION 'Fresh verified staging owner required';
  END IF;
END $$;
CREATE ROLE budograph_migrator NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE budograph_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 4 PASSWORD NULL VALID UNTIL '1970-01-01';
GRANT budograph_migrator TO postgres WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;
-- PG17 CREATEROLE grants ADMIN but not SET. Keep ADMIN for password management.
GRANT budograph_runtime TO postgres WITH INHERIT FALSE, SET TRUE;
GRANT CONNECT,CREATE ON DATABASE postgres TO budograph_migrator;
GRANT USAGE,CREATE ON SCHEMA public TO budograph_migrator;
GRANT CONNECT ON DATABASE postgres TO budograph_runtime;
GRANT USAGE ON SCHEMA public TO budograph_runtime;
-- Do not revoke provider/PUBLIC ACLs. Unexpected inherited CREATE must STOP.
ALTER DEFAULT PRIVILEGES FOR ROLE budograph_migrator REVOKE ALL ON TABLES FROM PUBLIC,budograph_runtime,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE budograph_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,budograph_runtime,anon,authenticated,service_role;
