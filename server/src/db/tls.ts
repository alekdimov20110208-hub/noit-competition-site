import { X509Certificate } from "node:crypto";
import { closeSync, fstatSync, openSync, readFileSync } from "node:fs";
import { checkServerIdentity, type ConnectionOptions } from "node:tls";
import { EnvironmentError, type DatabaseTls } from "../config/env.ts";

const MAX_CA_BYTES = 1024 * 1024;
const certificatePattern =
  /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

// Read once at pool creation, not per connection. Trust is supplied by the
// operator through a verified provider source, never learned from the endpoint.
function loadTrustedCa(file: string): string[] {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file, "r");
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_CA_BYTES)
      throw new Error("Invalid CA file size.");
    const pem = readFileSync(descriptor, "utf8");
    if (Buffer.byteLength(pem) > MAX_CA_BYTES)
      throw new Error("Invalid CA file size.");
    const certificates = pem.match(certificatePattern) ?? [];
    if (!certificates.length || pem.replace(certificatePattern, "").trim())
      throw new Error("Expected only PEM certificates.");
    const now = Date.now();
    for (const certificate of certificates) {
      const parsed = new X509Certificate(certificate);
      if (
        !parsed.ca ||
        !(Date.parse(parsed.validFrom) <= now) ||
        !(now <= Date.parse(parsed.validTo))
      )
        throw new Error("Expected currently valid CA certificates.");
    }
    return certificates;
  } catch {
    // Filesystem/OpenSSL errors can contain paths or certificate text. Do not
    // retain them as causes, log them, or substitute a weaker TLS mode.
    throw new EnvironmentError(
      "DATABASE_TLS_CA_FILE must be a readable PEM CA bundle (up to 1 MiB) containing only currently valid CA certificates.",
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function databaseSslOptions(
  config: DatabaseTls,
): false | ConnectionOptions {
  if (config.mode === "disable") return false;
  return {
    ca: loadTrustedCa(config.caFile),
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    checkServerIdentity,
  };
}
