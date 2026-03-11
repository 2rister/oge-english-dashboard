import http from "node:http";
import https from "node:https";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const POCKETBASE_PORT = "8091";
const VITE_PORT = "5173";
const EXPORT_API_PORT = "8092";
const LAUNCH_AGENT_LABEL = "com.2rister.oge-english-dashboard";
const pocketbaseBinary = path.join(rootDir, "pocketbase", "pocketbase");
const pbDataDir = path.join(rootDir, "pocketbase", "pb_data");
const children = [];
let shuttingDown = false;

void start();

async function start() {
  if (await isManagedStackAlreadyRunning()) {
    console.log("[start] services are already running via launchd");
    process.exit(0);
  }

  stopProcessOnPort(POCKETBASE_PORT, "PocketBase");
  stopProcessOnPort(VITE_PORT, "Vite");
  stopProcessOnPort(EXPORT_API_PORT, "Export API");

  const buildData = spawnSync(process.execPath, [path.join(rootDir, "scripts", "generate-report-data.mjs")], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  });

  if (buildData.status !== 0) {
    process.exit(buildData.status ?? 1);
  }

  const pocketbase = runProcess("pocketbase", pocketbaseBinary, [
    "serve",
    `--http=127.0.0.1:${POCKETBASE_PORT}`,
    "--dir",
    pbDataDir,
  ]);

  const vite = runProcess("vite", process.platform === "win32" ? "npm.cmd" : "npm", [
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    VITE_PORT,
  ]);

  const xlsxWatch = runProcess("xlsx-watch", process.execPath, [path.join(rootDir, "scripts", "watch-root-xlsx.mjs")]);
  const exportApi = runProcess("export-api", process.execPath, [path.join(rootDir, "scripts", "export-api.mjs")]);

  children.push(pocketbase, vite, xlsxWatch, exportApi);

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
}

async function isManagedStackAlreadyRunning() {
  const uid = process.getuid?.() ?? 501;
  const launchctlStatus = spawnSync("launchctl", ["print", `gui/${uid}/${LAUNCH_AGENT_LABEL}`], {
    cwd: rootDir,
    env: process.env,
    stdio: "ignore",
  });

  if (launchctlStatus.status !== 0) {
    return false;
  }

  const checks = await Promise.all([
    isHttpOk(`http://127.0.0.1:${POCKETBASE_PORT}/api/health`),
    isHttpOk(`http://127.0.0.1:${VITE_PORT}`),
    isHttpOk(`http://127.0.0.1:${EXPORT_API_PORT}/health`),
  ]);

  return checks.every(Boolean);
}

function isHttpOk(urlString) {
  const url = new URL(urlString);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const request = transport.request(
      url,
      {
        method: "GET",
      },
      (response) => {
        response.resume();
        resolve((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 400);
      },
    );

    request.on("error", () => resolve(false));
    request.end();
  });
}

function stopProcessOnPort(port, label) {
  const lookup = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8",
  });

  if (lookup.status !== 0 || !lookup.stdout.trim()) {
    return;
  }

  const pids = [...new Set(lookup.stdout.split(/\s+/).filter(Boolean))];
  console.log(`[start] stopping ${label} on port ${port}: ${pids.join(", ")}`);

  for (const pid of pids) {
    spawnSync("kill", ["-TERM", pid], { cwd: rootDir, env: process.env, stdio: "ignore" });
  }

  const recheck = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8",
  });

  if (recheck.stdout.trim()) {
    for (const pid of [...new Set(recheck.stdout.split(/\s+/).filter(Boolean))]) {
      spawnSync("kill", ["-KILL", pid], { cwd: rootDir, env: process.env, stdio: "ignore" });
    }
  }
}

function runProcess(name, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(prefixLines(name, chunk.toString(), false));
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(prefixLines(name, chunk.toString(), true));
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[${name}] exited with ${reason}`);
    if (name === "pocketbase" || name === "vite") {
      shutdown(code === 0 ? 1 : (code ?? 1));
      return;
    }
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
    shutdown(1);
  });

  return child;
}

function prefixLines(name, text, isError) {
  const color = isError ? "\u001b[31m" : "\u001b[36m";
  const reset = "\u001b[0m";

  return text
    .split(/\r?\n/)
    .map((line, index, lines) => {
      if (line === "" && index === lines.length - 1) {
        return "";
      }
      return `${color}[${name}]${reset} ${line}`;
    })
    .join("\n");
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(typeof exitCode === "number" ? exitCode : 0);
  }, 500).unref();

  setTimeout(() => {
    process.exit(typeof exitCode === "number" ? exitCode : 0);
  }, 50).unref();
}
