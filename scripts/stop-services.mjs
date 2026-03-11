import { spawnSync } from "node:child_process";

const launchAgentLabel = "com.2rister.oge-english-dashboard";
const uid = process.getuid?.() ?? 501;

if (spawnSync("launchctl", ["print", `gui/${uid}/${launchAgentLabel}`], { encoding: "utf8", env: process.env }).status === 0) {
  spawnSync("launchctl", ["bootout", `gui/${uid}`, `/Users/antonsemenov/Library/LaunchAgents/${launchAgentLabel}.plist`], {
    encoding: "utf8",
    env: process.env,
  });
  console.log(`[stop] unloaded launch agent ${launchAgentLabel}`);
}

for (const [port, label] of [
  ["8091", "PocketBase"],
  ["5173", "Vite"],
  ["8092", "Export API"],
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
