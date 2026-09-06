import { spawn } from "node:child_process";
// One Deploy Hatch project can supervise both long-lived processes. Split-service
// deployments can use start:web and worker independently with the same source.
const children = new Set();
let stopping = false;
function launch(args, env = process.env) {
  const p = spawn(process.execPath, args, { stdio: "inherit", env });
  children.add(p);
  p.on("exit", () => children.delete(p));
  return p;
}
function run(args) {
  return new Promise((resolve) => {
    const p = launch(args);
    p.once("exit", (code) => resolve(code === 0));
    p.once("error", () => resolve(false));
  });
}
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 2000).unref();
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => shutdown());
const web = launch([
  "node_modules/next/dist/bin/next",
  "start",
  "--hostname",
  "0.0.0.0",
  "--port",
  process.env.PORT || "3000",
]);
web.once("exit", (code) => shutdown(code || 0));
if (!process.env.DATABASE_URL) {
  console.error(
    JSON.stringify({
      service: "worker",
      status: "setup_required",
      missing: ["DATABASE_URL"],
    }),
  );
} else if (await run(["--import", "tsx", "scripts/migrate.ts"])) {
  let restarts = 0;
  function startWorker() {
    if (stopping) return;
    const worker = launch(["--import", "tsx", "worker/index.ts"], {
      ...process.env,
      PORT: process.env.WORKER_PORT || "3001",
    });
    worker.once("exit", () => {
      if (stopping) return;
      if (restarts++ < 5)
        setTimeout(startWorker, Math.min(60000, 5000 * 2 ** restarts));
      else
        console.error(
          JSON.stringify({
            service: "worker",
            status: "failed",
            reason: "restart_budget_exhausted",
          }),
        );
    });
  }
  startWorker();
} else {
  console.error(
    JSON.stringify({
      service: "worker",
      status: "setup_required",
      reason: "migration_failed",
    }),
  );
}
