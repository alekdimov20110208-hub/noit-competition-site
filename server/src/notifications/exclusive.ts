import type { Pool } from "pg";

// One pinned session holds the lock throughout a pass, while canonical worker
// transactions use their own clients. Requires direct or SESSION-pooled Postgres.
// The existing notification unique constraint remains the durable dedupe boundary.
export function exclusiveReminderWorker(
  pool: Pool,
  worker: { run(): Promise<number> },
) {
  return {
    async run() {
      const client = await pool.connect();
      let locked = false;
      let failed = false;
      const onError = () => {
        failed = true;
      };
      client.on("error", onError);
      try {
        const query = {
          text: "SELECT pg_try_advisory_lock(1112884303, 1380273481) AS locked",
          query_timeout: 5000,
        };
        let result;
        try {
          result = await client.query(query);
        } catch {
          // A timeout can leave the server-side outcome unknown. Never return
          // that session (possibly still holding the lock) to the pool.
          failed = true;
          throw new Error("Reminder lock acquisition failed.");
        }
        locked = result.rows[0]?.locked === true;
        if (!locked) return 0;
        return await worker.run();
      } finally {
        if (locked && !failed) {
          try {
            const query = {
              text: "SELECT pg_advisory_unlock(1112884303, 1380273481)",
              query_timeout: 5000,
            };
            await client.query(query);
          } catch {
            failed = true;
          }
        }
        client.release(failed);
        client.removeListener("error", onError);
      }
    },
  };
}
