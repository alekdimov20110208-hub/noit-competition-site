# Verified PostgreSQL client TLS

## Later accepted activation — 2026-10-17 checkpoint

The owner subsequently authorized development activation after the source-only
patch below. Actual application-pool TLS 1.3, certificate chain and hostname
verification were confirmed, including after the T2 backend replacement. See
[the activation evidence](BUDOGRAPH_EVENT_TEMPLATES_T2_ACTIVATION.md). T1/T2 are
owner-accepted, both 6/6. External trust configuration remains untracked; no CA
material or credentials are part of this checkpoint. The original inactive patch
and separate-authorization instructions below remain historical/operator guidance.

## Implementation status and scope

2026-10-16: source implementation only. Runtime activation requires separate
project-owner authorization. The existing backend/Vite, active environment files,
Supabase settings, sessions, records and migrations are not changed by this patch.
Event Management Stages 1-7 and their LOCK records retain their accepted semantics.
No dependency or certificate asset is added. This is transport hardening, not a
production deployment, security certification or permission for demo data writes.

## One configuration authority

All database consumers continue through `readDatabaseEnv` and the existing
`createDatabasePool`: the application, migration CLI and controlled verification
scripts use the same transport policy. No second permanent pool is introduced.

| Target                                                       | Default / permitted mode                           |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Development/test, exactly `localhost`, `127.0.0.1`, or `::1` | `disable` by default; `verify-full` also supported |
| Any remote target, including development Supabase            | `verify-full` required                             |
| Any production target, including loopback                    | `verify-full` required                             |

Configure `DATABASE_TLS_MODE=verify-full` and `DATABASE_TLS_CA_FILE` with the path
to a trusted PEM CA certificate/bundle. Relative paths resolve against the process
working directory. Use an absolute external path for activation, for example
`C:/BudoGraph-config/certs/provider-root.pem`. Do not commit credentials, active
environment files, private keys or deployment certificate configuration.

For intentional local plaintext development only, use `DATABASE_TLS_MODE=disable`
and omit `DATABASE_TLS_CA_FILE`. There is no remote plaintext override. Empty,
unknown or incompatible settings fail closed. Production and remote configurations
without the required CA path fail before constructing a pool; a missing/unreadable
file fails at pool creation. Existing remote `.env` files therefore need an
explicitly approved configuration update before the next start of this source.

`DATABASE_URL` must have **no query options**. This includes `ssl`, `sslmode`,
`sslrootcert`, `sslcert`, `sslkey`, `uselibpqcompat`, target overrides such as `host`,
and otherwise benign parameters such as `application_name`. Put connection target
and credentials in the URL authority/path; TLS belongs only in the named settings.
The installed pg 8.23.1 parses URL options after other client options and can replace
`ssl` or the host. Both the environment boundary and pool entry reject query options
before pg parses them or opens referenced certificate/key files. Ambient
`PGSSLMODE` cannot override an explicit `ssl` object or the deliberate local `false`.

## Trust and verification

Obtain the root CA through the provider's authenticated Dashboard or another
independently verified official source. Supabase documents the certificate download
under Database Settings / SSL Configuration:

- [Supabase SSL enforcement and verify-full](https://supabase.com/docs/guides/platform/ssl-enforcement)
- [Supabase Dashboard certificate-download source](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json)

The provider CA distribution's `prod` filename does not classify the application's
database as production. Confirm the intended project separately. Do not download
a presented endpoint certificate and automatically promote it to a trust anchor.
The application does not download certificates or change the system trust store.

At pool creation the file is loaded once, with a 1 MiB bound. It must contain only
PEM certificates, each parsed as a currently valid CA by Node's `X509Certificate`.
Malformed, non-CA, expired, not-yet-valid, empty, unreadable and mixed-content input
is rejected. Operator provenance remains essential: parsing does not prove who
supplied a CA. Replace/rotate expired material through a separately approved
configuration/restart procedure; existing pools do not hot-reload certificate files.

The pool supplies `rejectUnauthorized: true`, TLS >= 1.2, the explicit CA bundle,
and Node's normal `checkServerIdentity`. pg sets SNI to the validated URL's DNS host;
for IP targets its host option preserves IP/SAN checking without IP SNI. No hostname
override, accepting callback, partial-chain relaxation or plaintext retry is added.
Filesystem/OpenSSL configuration failures use fixed `EnvironmentError` messages
without their original causes. Existing idle-pool errors still notify without raw
errors. Never log URLs, the pool object, certificate text or credentials.

This verifies only **Node client -> connection endpoint**. With Supavisor that
endpoint is the pooler. It does not enable or certify pooler -> PostgreSQL TLS.
`pg_stat_ssl` on a pooled backend describes that upstream session, not the client's
TLS socket. Least-privilege grants/RLS bypass, production hosting and other
transport segments remain separate work.

## Validation and limits

Focused offline checks (no environment files loaded):

```powershell
node --test server/tests/env.test.ts server/tests/pool.test.ts server/tests/database-tls.test.ts server/tests/email.test.ts
node node_modules/typescript/bin/tsc -p server/tsconfig.json --pretty false
```

The new tests use public roots already bundled with Node, temporary OS files and
one ephemeral loopback protocol stub. No private key, network download or actual
PostgreSQL connection is used. The stub rejects pg's SSLRequest; the test confirms
that no startup packet, credentials, SQL or plaintext retry follows. Tests cover CA
loading/failures/validity, the actual pg Client URL merge, preserved pool limits and
idle-error handling, production/remote downgrade denial, ambient mode isolation,
and Node's hostname mismatch rejection. These unit checks do not constitute a
fresh real PostgreSQL TLS handshake or activation of the application pool.

Exact executed results and omissions for this patch are recorded in
[TEST_EVIDENCE](TEST_EVIDENCE.md). Earlier B.0.1 verified TLS/metadata evidence is
historical and separate; it must not be attributed to the new application pool.

## Separate owner-authorized activation steps

1. Review the patch and authorize the exact development target/configuration scope.
2. Obtain/review the official CA outside the repository and approve its provenance
   and fingerprint. Update only the approved development environment settings;
   retain the existing URL target and credentials, without URL query options.
3. Authorize one controlled backend restart with an explicit process/ownership
   preflight. Do not restart Vite or toggle Supabase SSL enforcement as a shortcut.
4. Verify a fresh application connection's chain, hostname and encrypted client
   socket, then perform only authorized read-only identity/schema/health checks.
   Do not infer client TLS from `pg_stat_ssl` behind a pooler.
5. Obtain separate authorization before any synthetic Event/Task/Change setup.

No activation, environment edit, restart or demo write is authorized by this file.
The original Stage 7 88/89 session discrepancy and its qualified acceptance are
unchanged; this patch does not repeat or repair that audit. Supplied NOIT rules are
for 2025-2026 and do not confirm 2026-2027 requirements.
