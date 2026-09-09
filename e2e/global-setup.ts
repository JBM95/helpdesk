import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";

export default function globalSetup() {
  const envPath = path.resolve(__dirname, "../server/.env.test");
  const env = dotenv.config({ path: envPath });

  console.log("Resetting test database...");

  const serverDir = path.resolve(__dirname, "../server");
  const execEnv = {
    ...process.env,
    ...env.parsed,
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "Yes",
  };

  execSync("bunx prisma migrate reset --force", {
    cwd: serverDir,
    stdio: "inherit",
    env: execEnv,
  });

  console.log("Running seed...");

  execSync("bun prisma/seed.ts", {
    cwd: serverDir,
    stdio: "inherit",
    env: execEnv,
  });

  // The reset above only clears `public`. pg-boss owns a separate `pgboss`
  // schema, so without this every run inherits the previous run's job backlog —
  // see the comment block in clear-job-queue.sql for why that makes the suite
  // progressively flakier.
  console.log("Clearing the pg-boss job queue...");

  execSync(
    `bunx prisma db execute --file "${path.resolve(
      __dirname,
      "clear-job-queue.sql"
    )}"`,
    { cwd: serverDir, stdio: "inherit", env: execEnv }
  );

  console.log("Test database ready.");
}
