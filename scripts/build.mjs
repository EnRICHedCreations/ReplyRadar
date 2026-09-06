import { rm, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
// Only remove disposable files inside this checkout. Hosts with a small build
// disk otherwise retain downloaded tarballs alongside expanded dependencies.
await rm(resolve(".npm-cache"), { recursive: true, force: true });
await rm(resolve(".next/cache"), { recursive: true, force: true });
const glibc = process.report.getReport().header.glibcVersionRuntime;
if (process.platform === "linux" && process.arch === "x64")
  await rm(
    resolve(
      "node_modules/@next",
      glibc ? "swc-linux-x64-musl" : "swc-linux-x64-gnu",
    ),
    { recursive: true, force: true },
  );
let removed = 0;
async function trimMaps(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await trimMaps(path);
    else if (entry.isFile() && entry.name.endsWith(".map")) {
      removed += (await stat(path)).size;
      await rm(path);
    }
  }
}
await trimMaps(resolve("node_modules"));
console.log(
  `Build preparation removed ${Math.round(removed / 1024 / 1024)} MB of dependency source maps.`,
);
const build = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit" },
);
build.once("exit", (code) => process.exit(code ?? 1));
