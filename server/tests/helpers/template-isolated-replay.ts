import { templateIsolatedPool } from "./template-isolated-db.ts";
import { createTemplateApplicationService } from "../../src/templates/service.ts";
const [actor, event, key, input] = process.argv.slice(2);
const pool = await templateIsolatedPool();
try {
  const result = await createTemplateApplicationService(pool).apply(
    { id: actor!, name: "Isolated", email: "isolated@example.invalid" },
    event!,
    key!,
    JSON.parse(input!),
  );
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}
