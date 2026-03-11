import { spawnSync } from "node:child_process";

for (const [port, label] of [
  ["8091", "PocketBase"],
  ["5173", "Vite"],
]) {
  const lookup = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    encoding: "utf8",
    env: process.env,
  });

  const pids = [...new Set(lookup.stdout.split(/\s+/).filter(Boolean))];
  if (pids.length === 0) {
    console.log(`[stop] ${label} on ${port}: nothing to stop`);
    continue;
  }

  console.log(`[stop] ${label} on ${port}: ${pids.join(", ")}`);
  for (const pid of pids) {
    spawnSync("kill", ["-TERM", pid], { stdio: "ignore", env: process.env });
  }
}
