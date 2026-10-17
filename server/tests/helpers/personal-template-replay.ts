import { templateIsolatedPool } from "./template-isolated-db.ts";
import { createPersonalTemplateService } from "../../src/templates/library.ts";
const pool = await templateIsolatedPool();
try {
  const user = {
    id: process.argv[2]!,
    name: "Synthetic",
    email: "synthetic@example.invalid",
  };
  const library = createPersonalTemplateService(pool);
  console.log(
    JSON.stringify({
      detail: await library.detail(user, process.argv[3]!),
      replay: await library.save(
        user,
        process.argv[4]!,
        process.argv[5],
        JSON.parse(process.argv[6]!),
      ),
    }),
  );
} finally {
  await pool.end();
}
