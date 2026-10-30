import type { FastifyInstance } from "fastify";

// SQL claim/nonce fencing and provider idempotency also cover concurrent
// request dispatches. A new pass starts only after the previous pass finishes.
export function registerEmailWorker(
  app: FastifyInstance,
  operations: { dispatch(): Promise<unknown>; cleanup(): Promise<unknown> },
  interval = 5000,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<unknown> | undefined;
  let stopped = false;
  let passes = 0;
  const tick = () => {
    running = (async () => {
      await operations.dispatch();
      if (passes++ % 12 === 0) await operations.cleanup();
    })()
      .catch(() => app.log.error("Email worker pass failed"))
      .finally(() => {
        running = undefined;
        if (!stopped) {
          timer = setTimeout(tick, interval);
          timer.unref();
        }
      });
  };
  app.addHook("onReady", async () => {
    tick();
  });
  app.addHook("onClose", async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  });
}
