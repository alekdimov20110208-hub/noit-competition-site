// Use one normalization for route validation, shared limits and transaction
// ownership. Forward the original URL to Better Auth for its own validation.
export function canonicalAuthPath(path: string) {
  try {
    return decodeURIComponent(path)
      .replace(/\/+/g, "/")
      .replace(/\/$/, "")
      .toLowerCase();
  } catch {
    return path;
  }
}
