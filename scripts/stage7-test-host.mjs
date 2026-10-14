// Owned test-host configuration and session cleanup. Assertion expectations and
// browser interactions stay intact; reminder candidates are restricted for isolation.
import { registerHooks } from "node:module";
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.includes("/scripts/verify-") && url.endsWith(".mjs")) {
      const configured = {
        ...result,
        source: result.source
          .toString()
          .replaceAll("\r\n", "\n")
          .replaceAll(
            '"tmp/p1d2-evidence/browser"',
            JSON.stringify(process.env.BUDOGRAPH_EVIDENCE_DIR),
          )
          .replaceAll(
            "http://127.0.0.1:5173",
            process.env.BUDOGRAPH_ISOLATED_ORIGIN,
          )
          .replaceAll(
            "http://127.0.0.1:3001",
            process.env.BUDOGRAPH_ISOLATED_BACKEND,
          ),
      };
      if (url.endsWith("/verify-task-reads-ui.mjs"))
        configured.source = configured.source.replace(
          "} catch {\n  report.failure =",
          `} catch (stage7Failure) {
  report.failureAt=stage7Failure.stack?.match(/verify-task-reads-ui\\.mjs:\\d+:\\d+/)?.[0]??null;
  const failedPage=contexts[0]?.pages()[0];
  if(failedPage){report.safeState=await failedPage.evaluate(()=>({path:location.pathname,rows:document.querySelectorAll('.task-row').length,alerts:document.querySelectorAll('[role=alert]').length,busy:document.querySelector('.page--tasks')?.getAttribute('aria-busy')})).catch(()=>null);await failedPage.screenshot({path:out+'/failure.png'}).catch(()=>{});}
  report.failure =`,
        );
      if (url.endsWith("/verify-task-reminders-ui.mjs")) {
        if (
          !configured.source.includes(
            "const worker = createReminderWorker(pool, () => instant);",
          )
        )
          throw Error(
            "Owned reminder candidate adapter cannot be installed safely",
          );
        configured.source = configured.source
          .replace(
            '"tmp/reminders-evidence/browser"',
            JSON.stringify(process.env.BUDOGRAPH_EVIDENCE_DIR),
          )
          .replace(
            "const worker = createReminderWorker(pool, () => instant);",
            `// Only candidate selection is restricted to this script's owned Tasks.
  // Production eligibility, locks, delivery SQL and all assertions are unchanged.
  const stage7OwnedPool={connect:async()=>{
    const connection=await pool.connect();
    return {on:connection.on.bind(connection),removeListener:connection.removeListener.bind(connection),release:connection.release.bind(connection),query:async(sql,values)=>{
      const result=await connection.query(sql,values);
      return sql.includes('SELECT r.id,t.id AS task_id')
        ? {...result,rows:result.rows.filter(r=>report.intentionalTasks.includes(r.task_id))}
        : result;
    }};
  }};
  const worker = createReminderWorker(stage7OwnedPool, () => instant);`,
          )
          .replaceAll(
            "createReminderWorker(pool, () => instant).run()",
            "createReminderWorker(stage7OwnedPool, () => instant).run()",
          )
          .replace(
            "await Promise.all(contexts.map((context) => context.close()));",
            "await Promise.all(contexts.map(async (context) => {await context.request.post(origin+'/api/auth/sign-out',{headers:{origin},data:{}}).catch(()=>{});await context.close();}));",
          );
        if (/createReminderWorker\(pool[,)]/.test(configured.source))
          throw Error(
            "Unrestricted reminder worker is forbidden in this test host",
          );
      }
      return configured;
    }
    return result;
  },
});
