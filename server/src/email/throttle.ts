import { createHash } from "node:crypto";
// Bounded, deterministic single-process limits. Direct peer IP only; no proxy trust.
export function createEmailThrottle(
  now = Date.now,
  limits = { identity: 3, ip: 10, global: 100 },
) {
  const counters = new Map<string, { count: number; expires: number }>();
  return (ip: string, recipientOrActor: string) => {
    const time = now();
    for (const [key, entry] of counters)
      if (entry.expires <= time) counters.delete(key);
    const hash = createHash("sha256")
      .update(recipientOrActor.trim().toLowerCase())
      .digest("hex");
    const rules = [
      [`ip:${ip}`, limits.ip],
      [`identity:${hash}`, limits.identity],
      ["global", limits.global],
    ] as const;
    if (
      counters.size >= 10_000 ||
      rules.some(([key, max]) => (counters.get(key)?.count ?? 0) >= max)
    )
      return false;
    for (const [key] of rules) {
      const entry = counters.get(key) ?? {
        count: 0,
        expires: time + 15 * 60_000,
      };
      entry.count++;
      counters.set(key, entry);
    }
    return true;
  };
}
